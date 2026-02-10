import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PedidoService } from '../../pedido/pedido.service';
import { PrinterService } from '../../printer/printer.service';
import { Repository } from 'typeorm';
import { Pedido } from '../../pedido/entities/pedido.entity';
import { TDocumentDefinitions } from 'pdfmake/interfaces';
import { join } from 'path';
import * as fs from 'fs';

@Injectable()
export class OrdenTrabajoReport {
  constructor(
    private readonly pedidoService: PedidoService,
    private readonly printerService: PrinterService,
    @InjectRepository(Pedido)
    private readonly pedidoRepository: Repository<Pedido>,
  ) {}

  /**
   * Genera el PDF de una Orden de Trabajo en formato exacto según el diseño proporcionado
   */
  async generarPDF(idPedido: number): Promise<PDFKit.PDFDocument> {
    // Obtener el pedido con todas sus relaciones
    const pedido = await this.pedidoService.findOne(idPedido);

    if (!pedido) {
      throw new NotFoundException(
        `El pedido con id ${idPedido} no fue encontrado`,
      );
    }

    // Cargar relaciones adicionales que no vienen en findOne
    const pedidoCompleto = await this.pedidoRepository.findOne({
      where: { idPedido },
      relations: [
        'empleado',
        'cliente',
        'direccion',
        'contactoEntrega',
        'detallesPedido',
        'detallesPedido.arreglo',
        'pago',
        'pago.metodoPago',
        'factura',
        'envio',
      ],
    });

    if (!pedidoCompleto) {
      throw new NotFoundException(
        `El pedido con id ${idPedido} no fue encontrado`,
      );
    }

    // Datos del pedido
    const direccionEntrega =
      pedidoCompleto.direccionTxt ||
      pedidoCompleto.direccion?.formattedAddress ||
      '';
    const clienteNombre = pedidoCompleto.cliente
      ? `${pedidoCompleto.cliente.primerNombre} ${pedidoCompleto.cliente.primerApellido}`
      : '';
    const telefonoOficina = pedidoCompleto.contactoEntrega?.telefono || '';

    // Arreglos florales
    const detalles = pedidoCompleto.detallesPedido || [];
    const arreglosFlorales = detalles.map((detalle) => {
      const nombreArreglo = detalle.arreglo?.nombre || 'Arreglo';
      const cantidad = detalle.cantidad;
      return `${cantidad}x ${nombreArreglo}`;
    });

    // Datos financieros (solo los necesarios)
    const valor = Number(pedidoCompleto.totalPedido || 0);
    const transporte = pedidoCompleto.envio?.costoEnvio 
      ? Number(pedidoCompleto.envio.costoEnvio) 
      : 0;
    const numFactura = pedidoCompleto.factura?.numFactura || '';

    const fechaEntrega = pedidoCompleto.fechaEntregaEstimada
      ? new Date(pedidoCompleto.fechaEntregaEstimada).toLocaleDateString(
          'es-NI',
          {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          },
        )
      : '';

    const mensaje = pedidoCompleto.mensajePedido || '';

    // Conversión de cm a puntos para pdfmake
    const CM = 28.3464567;
    const PAGE_WIDTH = Math.round(13.7 * CM);
    // Posiciones para las medidas exactas solicitadas (13.7cm x 21.4cm), más a la izquierda y arriba
    const positions = {
      // Enviarse a: primera línea (más arriba), un poco a la derecha
      enviarseA: { x: 110, y: 105 },
      // Solicitado por y Tel Oficina en la misma línea
      solicitadoPor: { x: 150 , y: 145 },
      telOficina: { x: 270, y: 180 },
      // Arreglos florales más a la derecha
      arreglosStart: { x: 240, y: 260, gap: 20 },
      cintaTarjeta: { x: 160, y: 330 },
      // Valor: más a la izquierda, manteniendo la altura relativa
      valor: { x: 110, y: 320 },
      transporte: { x: 230, y: 3 },
      // Factura: abajo a la derecha, un poco más arriba que la fecha
      factura: { x: 260, y: 315},
      // Fecha: abajo a la izquierda
      fechaEntrega: { x: 135, y: 400 },
    };

    const content: any[] = [
      {
        text: direccionEntrega,
        fontSize: 10,
        // Si el texto es largo, se partirá en varias líneas dentro de este ancho
        width: Math.max(120, PAGE_WIDTH - positions.enviarseA.x - 20),
        absolutePosition: positions.enviarseA,
      },
      {
        text: clienteNombre,
        fontSize: 10,
        absolutePosition: positions.solicitadoPor,
      },
      {
        text: telefonoOficina,
        fontSize: 10,
        absolutePosition: positions.telOficina,
      },
      ...Array.from({ length: Math.max(4, arreglosFlorales.length) }).map(
        (_, i) => ({
          text: arreglosFlorales[i] || '',
          fontSize: 10,
          absolutePosition: {
            x: positions.arreglosStart.x,
            y: positions.arreglosStart.y + positions.arreglosStart.gap * i,
          },
        }),
      ),
      {
        text: mensaje,
        fontSize: 7,
        absolutePosition: positions.cintaTarjeta,
      },
      {
        text: valor ? valor.toFixed(2) : '',
        fontSize: 7,
        absolutePosition: positions.valor,
      },
      {
        text: transporte ? transporte.toFixed(2) : '',
        fontSize: 10,
        absolutePosition: positions.transporte,
      },
      {
        text: numFactura,
        fontSize: 10,
        absolutePosition: positions.factura,
      },
      {
        text: fechaEntrega,
        fontSize: 10,
        absolutePosition: positions.fechaEntrega,
      },
    ];

    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: Math.round(13.7 * CM), height: Math.round(21.4 * CM) },
      pageOrientation: 'portrait',
      pageMargins: [0, 0, 0, 0],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 10,
        color: '#000000',
        lineHeight: 1.1,
      },
      content,
    };

    return this.printerService.createPdf(docDefinition);
  }
}

