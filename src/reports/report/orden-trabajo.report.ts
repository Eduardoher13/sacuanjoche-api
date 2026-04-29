import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PedidoService } from '../../pedido/pedido.service';
import { PrinterService } from '../../printer/printer.service';
import { Repository } from 'typeorm';
import { Pedido } from '../../pedido/entities/pedido.entity';
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

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

    const ContactoNombre = pedidoCompleto.contactoEntrega
      ? `${pedidoCompleto.contactoEntrega.nombre} ${pedidoCompleto.contactoEntrega.apellido} ${pedidoCompleto.contactoEntrega.telefono}`
      : '';

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
      const nombreArreglo = detalle.arreglo ? `${detalle.arreglo.nombre} ${detalle.arreglo.descripcion}`: '';
      const cantidad = detalle.cantidad;
      return `${cantidad}x ${nombreArreglo}`;
    });

    // Datos financieros (solo los necesarios)
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
    const PAGE_WIDTH = Math.round(14.8 * CM);
    const PAGE_HEIGHT = Math.round(21.0 * CM);
    const cmToPt = (valueCm: number): number =>
      Number((valueCm * CM).toFixed(2));

    // Activa guía visual con: ORDEN_TRABAJO_DEBUG=true
    const debugFlagRaw = process.env.ORDEN_TRABAJO_DEBUG ?? '';
    const DEBUG_LAYOUT = ['1', 'true', 'yes', 'on'].includes(
      debugFlagRaw.trim().toLowerCase(),
    );

    const fontSizeBase = 11;
    const arregloFontSize = 11;
    const arregloLineHeight = 1.1;

    const estimateLines = (
      value: string,
      width: number,
      fontSize: number,
    ): number => {
      if (!value) return 1;
      const avgCharWidth = fontSize * 0.46;
      const charsPerLine = Math.max(10, Math.floor(width / avgCharWidth));
      return Math.max(1, Math.ceil(value.length / charsPerLine));
    };

    // Posiciones para A5 (14.8cm x 21.0cm)
    const positions = {
      // Coordenadas convertidas de cm a pt
      nombresContacto: { x: cmToPt(3.4), y: cmToPt(5.3) },
      direccionesEntrega: { x: cmToPt(3.4), y: cmToPt(6.3) },
      solicitadoPor: { x: cmToPt(4.2), y: cmToPt(7.8) },
      telOficina: { x: cmToPt(10.8), y: cmToPt(10.9) },
      arreglosStart: { x: cmToPt(5.2), y: cmToPt(10.2), gap: 6 },
      cintaTarjeta: { x: 160, y: 330 },
      transporte: { x: 230, y: 3 },
      // Factura: abajo a la derecha, un poco más arriba que la fecha
      factura: { x: 260, y: 315 },
      fechaEntrega: { x: cmToPt(3.9), y: cmToPt(18.5) },
    };

    const debugPoints = [
      { label: 'nombresContacto', x: positions.nombresContacto.x, y: positions.nombresContacto.y },
      {
        label: 'direccionesEntrega',
        x: positions.direccionesEntrega.x,
        y: positions.direccionesEntrega.y,
      },
      { label: 'solicitadoPor', x: positions.solicitadoPor.x, y: positions.solicitadoPor.y },
      { label: 'telOficina', x: positions.telOficina.x, y: positions.telOficina.y },
      { label: 'arreglosStart', x: positions.arreglosStart.x, y: positions.arreglosStart.y },
      { label: 'cintaTarjeta', x: positions.cintaTarjeta.x, y: positions.cintaTarjeta.y },
      { label: 'transporte', x: positions.transporte.x, y: positions.transporte.y },
      { label: 'factura', x: positions.factura.x, y: positions.factura.y },
      { label: 'fechaEntrega', x: positions.fechaEntrega.x, y: positions.fechaEntrega.y },
    ];

    // Margen derecho más amplio para forzar salto de línea temprano
    // y evitar recortes en impresión física.
    const arreglosBlockWidth = Math.max(
      95,
      PAGE_WIDTH - positions.arreglosStart.x - 70,
    );

    const arregloGap: number = positions.arreglosStart.gap;
    const arregloLineHeightPt = arregloFontSize * arregloLineHeight;
    const minRows = Math.max(4, arreglosFlorales.length);

    const estimatedArreglosHeight = Array.from({ length: minRows }).reduce<number>(
      (total, _, i) => {
        const textValue = arreglosFlorales[i] || '';
        const lines = estimateLines(textValue, arreglosBlockWidth, arregloFontSize);
        return total + lines * arregloLineHeightPt + arregloGap;
      },
      0,
    );

    const arreglosBottomY =
      positions.arreglosStart.y + Math.max(estimatedArreglosHeight, 0);

    // Desplaza secciones de abajo cuando las descripciones de arreglos crecen.
    const sectionSpacing = 10;
    const adjustedCintaY = Math.max(
      positions.cintaTarjeta.y,
      arreglosBottomY + sectionSpacing,
    );

    const facturaToCintaOffset = positions.factura.y - positions.cintaTarjeta.y;
    const adjustedFacturaY = Math.max(
      positions.factura.y,
      adjustedCintaY + facturaToCintaOffset,
    );

    const fechaToFacturaOffset = positions.fechaEntrega.y - positions.factura.y;
    const adjustedFechaY = Math.min(
      PAGE_HEIGHT - 14,
      Math.max(positions.fechaEntrega.y, adjustedFacturaY + fechaToFacturaOffset),
    );

    const arreglosTexto = Array.from({ length: minRows })
      .map((_, i) => arreglosFlorales[i] || ' ')
      .join('\n\n');

    const sections: Record<string, Content> = {
      header: {
        absolutePosition: positions.transporte,
        columns: [
          {
            width: 'auto',
            text: transporte ? transporte.toFixed(2) : '',
            fontSize: fontSizeBase,
          },
        ],
      },
      destinatario: {
        absolutePosition: {
          x: positions.direccionesEntrega.x,
          y: positions.nombresContacto.y,
        },
        width: PAGE_WIDTH - positions.direccionesEntrega.x - 15,
        stack: [
          {
            columns: [
              {
                width: 'auto',
                text: ContactoNombre,
                fontSize: fontSizeBase,
                margin: [
                  Math.max(0, positions.nombresContacto.x - positions.direccionesEntrega.x),
                  0,
                  0,
                  4,
                ],
              },
            ],
          },
          {
            columns: [
              {
                width: '*',
                text: direccionEntrega,
                fontSize: fontSizeBase,
                margin: [0, 0, 0, 6],
              },
            ],
          },
          {
            columns: [
              {
                width: Math.max(80, positions.telOficina.x - positions.solicitadoPor.x - 10),
                text: clienteNombre,
                fontSize: fontSizeBase,
                margin: [
                  Math.max(0, positions.solicitadoPor.x - positions.direccionesEntrega.x),
                  positions.solicitadoPor.y - positions.direccionesEntrega.y - 24,
                  8,
                  0,
                ],
              },
              {
                width: '*',
                text: telefonoOficina,
                fontSize: fontSizeBase,
                margin: [0, positions.telOficina.y - positions.solicitadoPor.y - 2, 0, 0],
              },
            ],
          },
        ],
      },
      arreglos: {
        absolutePosition: {
          x: positions.arreglosStart.x,
          y: positions.arreglosStart.y,
        },
        columns: [
          {
            width: arreglosBlockWidth,
            text: arreglosTexto,
            fontSize: arregloFontSize,
            lineHeight: arregloLineHeight,
          },
        ],
      },
      footer: {
        absolutePosition: {
          x: positions.cintaTarjeta.x,
          y: adjustedCintaY,
        },
        width: PAGE_WIDTH - positions.cintaTarjeta.x - 20,
        stack: [
          {
            columns: [
              {
                width: '*',
                text: mensaje,
                fontSize: fontSizeBase,
                margin: [0, 0, 0, 6],
              },
            ],
          },
        ],
      },
      factura: {
        absolutePosition: { x: positions.factura.x, y: adjustedFacturaY },
        columns: [
          {
            width: 'auto',
            text: numFactura,
            fontSize: fontSizeBase,
          },
        ],
      },
      fecha: {
        absolutePosition: { x: positions.fechaEntrega.x, y: adjustedFechaY },
        columns: [
          {
            width: 'auto',
            text: fechaEntrega,
            fontSize: fontSizeBase,
          },
        ],
      },
    };

    const content: Content[] = [
      sections.header,
      sections.destinatario,
      sections.arreglos,
      sections.footer,
      sections.factura,
      sections.fecha,
      {
        text: `DEBUG_ENV="${debugFlagRaw || 'undefined'}" | DEBUG_ACTIVE=${DEBUG_LAYOUT}`,
        fontSize: 8,
        color: DEBUG_LAYOUT ? '#0a7f00' : '#cc0000',
        absolutePosition: { x: 8, y: PAGE_HEIGHT - 12 },
      },
    ];

    if (DEBUG_LAYOUT) {
      const gridStep = 20;
      const gridLines: any[] = [];

      for (let x = 0; x <= PAGE_WIDTH; x += gridStep) {
        gridLines.push({ type: 'line', x1: x, y1: 0, x2: x, y2: PAGE_HEIGHT, lineWidth: 0.3, lineColor: '#dddddd' });
      }

      for (let y = 0; y <= PAGE_HEIGHT; y += gridStep) {
        gridLines.push({ type: 'line', x1: 0, y1: y, x2: PAGE_WIDTH, y2: y, lineWidth: 0.3, lineColor: '#dddddd' });
      }

      const debugContent: Content[] = [
        {
          absolutePosition: { x: 0, y: 0 },
          canvas: gridLines,
        } as Content,
      ];

      for (const point of debugPoints) {
        debugContent.push(
          {
            absolutePosition: { x: Math.max(0, point.x - 3), y: Math.max(0, point.y - 3) },
            canvas: [
              { type: 'line', x1: 0, y1: 3, x2: 6, y2: 3, lineWidth: 1, lineColor: '#ff0000' },
              { type: 'line', x1: 3, y1: 0, x2: 3, y2: 6, lineWidth: 1, lineColor: '#ff0000' },
            ],
          } as Content,
          {
            text: `${point.label} (${point.x}, ${point.y})`,
            fontSize: 7,
            color: '#cc0000',
            absolutePosition: {
              x: Math.min(PAGE_WIDTH - 95, point.x + 4),
              y: Math.max(0, point.y - 8),
            },
          },
        );
      }

      content.push(...debugContent);
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
      pageOrientation: 'portrait',
      pageMargins: [0, 0, 0, 0],
      defaultStyle: {
        font: 'Roboto',
        fontSize: fontSizeBase,
        bold: true,
        color: '#000000',
        lineHeight: 1.1,
      },
      content,
    };

    return this.printerService.createPdf(docDefinition);
  }
}

