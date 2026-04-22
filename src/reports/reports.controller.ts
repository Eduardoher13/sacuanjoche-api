import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Res,
  HttpException,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { FindPedidosDto } from '../pedido/dto/find-pedidos.dto';
import { FindPedidosReporteDto } from '../pedido/dto/find-pedidos-reporte.dto';
import { FindFacturasDto } from '../factura/dto/find-facturas.dto';
import { FindArreglosDto } from '../arreglo/dto/find-arreglos.dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';

@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('factura/:idFactura/pdf')
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.cliente)
  @ApiOperation({
    summary: 'Generar PDF de factura',
    description:
      'Genera un PDF de la factura en el formato exacto del diseño proporcionado',
  })
  @ApiParam({
    name: 'idFactura',
    description: 'ID de la factura a generar en PDF',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Factura no encontrada',
  })
  async generarFacturaPDF(
    @Param('idFactura', ParseIntPipe) idFactura: number,
    @Res() res: Response,
  ) {
    try {
      const pdfDoc = await this.reportsService.generarFacturaPDF(idFactura);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=factura-${idFactura}.pdf`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.NOT_FOUND
      ) {
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error al generar el PDF de la factura',
        });
      }
    }
  }

  @Get('pedido/:idPedido/orden-trabajo/pdf')
  @Auth(ValidRoles.admin, ValidRoles.vendedor, ValidRoles.conductor)
  @ApiOperation({
    summary: 'Generar PDF de Orden de Trabajo',
    description:
      'Genera un PDF de la Orden de Trabajo del pedido en el formato exacto del diseño proporcionado',
  })
  @ApiParam({
    name: 'idPedido',
    description: 'ID del pedido para generar la Orden de Trabajo',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Pedido no encontrado',
  })
  async generarOrdenTrabajoPDF(
    @Param('idPedido', ParseIntPipe) idPedido: number,
    @Res() res: Response,
  ) {
    try {
      const pdfDoc = await this.reportsService.generarOrdenTrabajoPDF(idPedido);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=orden-trabajo-${idPedido}.pdf`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error: unknown) {
      if (
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.NOT_FOUND
      ) {
        res.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: error.message,
        });
      } else {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error al generar el PDF de la Orden de Trabajo',
        });
      }
    }
  }

  @Get('pedidos/pdf')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary: 'Generar PDF de reporte de pedidos',
    description:
      'Genera un PDF con el reporte de todos los pedidos. Opcionalmente se pueden aplicar filtros de búsqueda.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Texto a buscar en dirección, nombre del cliente, empleado o contacto de entrega',
    example: 'Juan',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generarPedidosPDF(
    @Query() filters: FindPedidosDto,
    @Res() res: Response,
  ) {
    try {
      const pdfDoc = await this.reportsService.generarPedidosPDF(filters);

      res.setHeader('Content-Type', 'application/pdf');
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reporte-pedidos-${fecha}.pdf`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al generar el PDF del reporte de pedidos',
      });
    }
  }

  @Get('facturas/pdf')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary: 'Generar PDF de reporte de facturas',
    description:
      'Genera un PDF con el reporte de todas las facturas. Opcionalmente se pueden aplicar filtros de búsqueda.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Texto a buscar en número de factura, estado, pedido o nombre del empleado',
    example: 'FAC-2025-001',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generarFacturasPDF(
    @Query() filters: FindFacturasDto,
    @Res() res: Response,
  ) {
    try {
      const pdfDoc = await this.reportsService.generarFacturasPDF(filters);

      res.setHeader('Content-Type', 'application/pdf');
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reporte-facturas-${fecha}.pdf`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al generar el PDF del reporte de facturas',
      });
    }
  }

  @Get('arreglos/pdf')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary: 'Generar PDF de reporte de arreglos',
    description:
      'Genera un PDF con el reporte de todos los arreglos, incluyendo sus flores y accesorios. Opcionalmente se pueden aplicar filtros de búsqueda.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description:
      'Texto a buscar en el nombre, descripción o forma del arreglo',
    example: 'Bouquet',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generarArreglosPDF(
    @Query() filters: FindArreglosDto,
    @Res() res: Response,
  ) {
    try {
      const pdfDoc = await this.reportsService.generarArreglosPDF(filters);

      res.setHeader('Content-Type', 'application/pdf');
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reporte-arreglos-${fecha}.pdf`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al generar el PDF del reporte de arreglos',
      });
    }
  }

  @Get('pedidos/detallado/pdf')
  @Auth(ValidRoles.admin, ValidRoles.vendedor)
  @ApiOperation({
    summary: 'Generar PDF de reporte detallado de pedidos',
    description:
      'Genera un PDF con el reporte detallado de pedidos, incluyendo descripción del pedido y arreglos florales detallados (con flores y accesorios). Si no se especifica el rango de fechas, se usa la fecha de hoy.',
  })
  @ApiQuery({
    name: 'fechaInicio',
    required: false,
    description: 'Fecha de inicio del rango (formato YYYY-MM-DD). Si no se especifica, se usa la fecha de hoy',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'fechaFin',
    required: false,
    description: 'Fecha de fin del rango (formato YYYY-MM-DD). Si no se especifica, se usa la fecha de hoy',
    example: '2024-12-31',
  })
  @ApiResponse({
    status: 200,
    description: 'PDF generado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  async generarPedidosDetalladoPDF(
    @Query() filters: FindPedidosReporteDto,
    @Res() res: Response,
  ) {
    try {
      const pdfDoc = await this.reportsService.generarPedidosDetalladoPDF(
        filters,
      );

      res.setHeader('Content-Type', 'application/pdf');
      const fecha = new Date().toISOString().split('T')[0];
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=reporte-pedidos-detallado-${fecha}.pdf`,
      );

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error al generar el PDF del reporte detallado de pedidos',
      });
    }
  }
}

