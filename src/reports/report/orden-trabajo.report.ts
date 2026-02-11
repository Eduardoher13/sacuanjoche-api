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
    const PAGE_WIDTH = Math.round(13.9 * CM); // 394 pts
    const PAGE_HEIGHT = Math.round(21.2 * CM); // 601 pts

    // Posiciones estimadas basadas en la imagen proporcionada
    const positions = {
      // Dirección: Centrada arriba (aprox 1/5 de la página)
      enviarseA: { x: 90, y: 145 },

      // Cliente: Debajo de la dirección, centrado
      solicitadoPor: { x: 10, y: 209 },

      // Teléfono: A la derecha, debajo del nombre
      telOficina: { x: 280, y: 270 },

      // Arreglos florales: Centro de la página
      arreglosStart: { x: 180, y: 330, gap: 20 },

      // Mensaje: Debajo de los arreglos
      cintaTarjeta: { x: 130, y: 350 },

      // Valor: Izquierda abajo
      valor: { x: 90, y: 450 }, // Ajustado para estar alineado visualmente

      // Transporte: (No visible claramente en imagen, lo mantengo oculto o discreto)
      transporte: { x: 350, y: 10 },

      // Factura: Derecha, altura similar al valor
      factura: { x: 296, y: 450 },

      // Fecha: Abajo del todo
      fechaEntrega: { x: 140, y: 560 },
    };

    const content: any[] = [
      {
        text: direccionEntrega,
        fontSize: 12,
        // Ancho suficiente para que se centre visualmente si es largo
        width: 250,
        absolutePosition: positions.enviarseA,
        alignment: 'center',
      },
      {
        text: clienteNombre,
        fontSize: 12,
        absolutePosition: positions.solicitadoPor,
        width: 250,
        alignment: 'center',
      },
      {
        text: telefonoOficina,
        fontSize: 12,
        absolutePosition: positions.telOficina,
      },
      ...Array.from({ length: Math.max(4, arreglosFlorales.length) }).map(
        (_, i) => ({
          text: arreglosFlorales[i] || '',
          fontSize: 12,
          absolutePosition: {
            x: positions.arreglosStart.x,
            y: positions.arreglosStart.y + positions.arreglosStart.gap * i,
          },
        }),
      ),
      {
        text: mensaje,
        fontSize: 12,
        width: 200,
        alignment: 'center',
        absolutePosition: positions.cintaTarjeta,
      },
      {
        text: valor ? valor.toFixed(2) : '',
        fontSize: 12,
        absolutePosition: positions.valor,
      },
      {
        text: transporte ? transporte.toFixed(2) : '',
        fontSize: 10, // Pequeño
        absolutePosition: positions.transporte,
      },
      {
        text: numFactura,
        fontSize: 12,
        absolutePosition: positions.factura,
      },
      {
        text: fechaEntrega,
        fontSize: 12,
        absolutePosition: positions.fechaEntrega,
      },
    ];

    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      pageOrientation: 'portrait',
      pageMargins: [10, 10, 10, 10],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 14,
        color: '#000000',
        lineHeight: 1.1,
      },
      content,
    };

    return this.printerService.createPdf(docDefinition);
  }
}
