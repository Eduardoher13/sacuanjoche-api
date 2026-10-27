import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PedidoService } from '../../pedido/pedido.service';
import { PrinterService } from '../../printer/printer.service';
import { Repository } from 'typeorm';
import { Pedido } from '../../pedido/entities/pedido.entity';
import { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  A5_PAGE_SIZE_MM,
  a5PageSize,
  mmToPt,
} from './a5-layout';

const BACKGROUND_IMAGE_PATH = resolve(__dirname, '../../../a5-1.png');
const SOURCE_PAGE_SIZE_MM = { width: 133, height: 200 };
const SCALE_X = A5_PAGE_SIZE_MM.width / SOURCE_PAGE_SIZE_MM.width;
const SCALE_Y = A5_PAGE_SIZE_MM.height / SOURCE_PAGE_SIZE_MM.height;

interface CampoTemplate {
  key: string;
  x: number;
  y: number;
  width?: number;
  fontSize?: number;
  lineHeight?: number;
}

// Coordenadas del formulario anterior, medidas en una hoja de 133 x 200 mm.
// Se transforman a A5 para conservar la alineación con el diseño ampliado.
const CAMPOS: CampoTemplate[] = [
  { key: 'contacto', x: 25, y: 48, width: 90, fontSize: 11 },
  { key: 'direccion', x: 23, y: 55, width: 90, fontSize: 11 },
  { key: 'solicitado', x: 30, y: 75, width: 85, fontSize: 11 },
  { key: 'telefono', x: 95, y: 101, width: 40, fontSize: 11 },
  { key: 'arreglo1', x: 40, y: 108, width: 55, fontSize: 11, lineHeight: 1.35 },
  { key: 'fecha', x: 25, y: 185, width: 50, fontSize: 11 },
];

function isDebugFlagEnabled(value: string | undefined): boolean {
  return ['0', 'false', 'no', 'off'].includes(value?.trim().toLowerCase() ?? '');
}

function loadBackgroundImage(): string {
  if (!existsSync(BACKGROUND_IMAGE_PATH)) {
    throw new Error(
      `No se encontró la imagen de fondo de la Orden de Trabajo: ${BACKGROUND_IMAGE_PATH}`,
    );
  }

  return `data:image/png;base64,${readFileSync(BACKGROUND_IMAGE_PATH).toString('base64')}`;
}

function createDebugGrid() {
  const width = mmToPt(A5_PAGE_SIZE_MM.width);
  const height = mmToPt(A5_PAGE_SIZE_MM.height);
  const step = mmToPt(10);
  const lineItems: Content[] = [];

  for (let x = 0; x <= width; x += step) {
    const millimeters = Math.round(x / mmToPt(1));
    const major = millimeters % 50 === 0;
    lineItems.push({
      canvas: [
        {
          type: 'line',
          x1: x,
          y1: 0,
          x2: x,
          y2: height,
          lineWidth: major ? 0.8 : 0.35,
          lineColor: major ? '#d64545' : '#e58b8b',
          dash: major ? undefined : { length: 1, space: 2 },
        },
      ],
    });
  }

  for (let y = 0; y <= height; y += step) {
    const millimeters = Math.round(y / mmToPt(1));
    const major = millimeters % 50 === 0;
    lineItems.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: y,
          x2: width,
          y2: y,
          lineWidth: major ? 0.8 : 0.35,
          lineColor: major ? '#d64545' : '#e58b8b',
          dash: major ? undefined : { length: 1, space: 2 },
        },
      ],
    });
  }

  for (let x = 0; x <= A5_PAGE_SIZE_MM.width; x += 10) {
    lineItems.push({
      text: `${x} mm`,
      absolutePosition: { x: mmToPt(x) + 1, y: 1 },
      fontSize: 5,
      color: '#b02020',
    });
  }

  for (let y = 10; y <= A5_PAGE_SIZE_MM.height; y += 10) {
    lineItems.push({
      text: `${y} mm`,
      absolutePosition: { x: 1, y: mmToPt(y) + 1 },
      fontSize: 5,
      color: '#b02020',
    });
  }

  return lineItems;
}

@Injectable()
export class OrdenTrabajoReport {
  constructor(
    private readonly pedidoService: PedidoService,
    private readonly printerService: PrinterService,
    @InjectRepository(Pedido)
    private readonly pedidoRepository: Repository<Pedido>,
  ) {}

  async generarPDF(idPedido: number): Promise<PDFKit.PDFDocument> {
    const pedido = await this.pedidoService.findOne(idPedido);

    if (!pedido) {
      throw new NotFoundException(
        `El pedido con id ${idPedido} no fue encontrado`,
      );
    }

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

    const contacto = pedidoCompleto.contactoEntrega
      ? `${pedidoCompleto.contactoEntrega.nombre} ${pedidoCompleto.contactoEntrega.apellido}`
      : '';
    const direccion =
      pedidoCompleto.direccionTxt ||
      pedidoCompleto.direccion?.formattedAddress ||
      '';
    const solicitado = pedidoCompleto.cliente
      ? `${pedidoCompleto.cliente.primerNombre} ${pedidoCompleto.cliente.primerApellido}`
      : '';
    const telefono = pedidoCompleto.contactoEntrega?.telefono || '';
    const fecha = pedidoCompleto.fechaEntregaEstimada
      ? new Date(pedidoCompleto.fechaEntregaEstimada).toLocaleDateString(
          'es-NI',
          { year: 'numeric', month: '2-digit', day: '2-digit' },
        )
      : '';

    const arreglos = (pedidoCompleto.detallesPedido || []).map((detalle) => {
      const nombreArreglo = detalle.arreglo
        ? `${detalle.arreglo.nombre} ${detalle.arreglo.descripcion}`
        : '';
      return `${detalle.cantidad}x ${nombreArreglo}`;
    });

    const arreglosLineas = arreglos.slice(0, 6);
    if (arreglos.length > 6) {
      arreglosLineas[5] = arreglos.slice(5).join(' / ');
    }

    const datos: Record<string, string> = {
      contacto,
      direccion,
      solicitado,
      telefono,
      fecha,
    };

    arreglosLineas.forEach((linea, index) => {
      datos[`arreglo${index + 1}`] = linea;
    });

    const content: Content[] = CAMPOS.filter((campo) => !!datos[campo.key]).map(
      (campo) => ({
        absolutePosition: {
          x: mmToPt(campo.x * SCALE_X),
          y: mmToPt(campo.y * SCALE_Y),
        },
        columns: [
          {
            width: campo.width
              ? mmToPt(campo.width * SCALE_X)
              : 'auto',
            text: datos[campo.key] || '',
            bold: true,
            fontSize: campo.fontSize ?? 11,
            lineHeight: campo.lineHeight,
          },
        ],
      }),
    );

    const debugBackground: Content[] = [];
    const debugEnabled = isDebugFlagEnabled(process.env.ORDEN_TRABAJO_DEBUG);
    const backgroundEnabled =
      debugEnabled ||
      isDebugFlagEnabled(process.env.ORDEN_TRABAJO_DEBUG_BACKGROUND);
    const gridEnabled =
      debugEnabled || isDebugFlagEnabled(process.env.ORDEN_TRABAJO_DEBUG_GRID);

    if (backgroundEnabled) {
      debugBackground.push({
        image: loadBackgroundImage(),
        width: mmToPt(A5_PAGE_SIZE_MM.width),
        height: mmToPt(A5_PAGE_SIZE_MM.height),
      });
    }
    if (gridEnabled) {
      debugBackground.push(...createDebugGrid());
    }

    const docDefinition: TDocumentDefinitions = {
      pageSize: a5PageSize(),
      pageOrientation: 'portrait',
      pageMargins: [0, 0, 0, 0],
      defaultStyle: {
        font: 'Roboto',
        color: '#000000',
      },
      background:
        debugBackground.length > 0 ? { stack: debugBackground } : undefined,
      content,
    };

    return this.printerService.createPdf(docDefinition);
  }
}
