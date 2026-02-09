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

    const positions = {
      enviarseA: { x: 135, y: 205 },
      solicitadoPor: { x: 150, y: 300 },
      telOficina: { x: 420, y: 340 },
      arreglosStart: { x: 220, y: 380, gap: 20 },
      cintaTarjeta: { x: 190, y: 560 },
      valor: { x: 140, y: 610 },
      transporte: { x: 375, y: 610 },
      factura: { x: 490, y: 610 },
      fechaEntrega: { x: 160, y: 740 },
    };

    const content: any[] = [
      {
        text: direccionEntrega,
        fontSize: 10,
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
        fontSize: 10,
        absolutePosition: positions.cintaTarjeta,
      },
      {
        text: valor ? valor.toFixed(2) : '',
        fontSize: 10,
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
      pageSize: 'LETTER',
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

