import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContactoEntregaDto } from './create-contacto-entrega.dto';

describe('CreateContactoEntregaDto', () => {
  it('permite omitir el telefono', async () => {
    const dto = plainToInstance(CreateContactoEntregaDto, {
      nombre: 'Maria',
      apellido: 'Perez',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('permite enviar el telefono como null', async () => {
    const dto = plainToInstance(CreateContactoEntregaDto, {
      nombre: 'Maria',
      apellido: 'Perez',
      telefono: null,
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('conserva las validaciones cuando se proporciona el telefono', async () => {
    const dto = plainToInstance(CreateContactoEntregaDto, {
      nombre: 'Maria',
      apellido: 'Perez',
      telefono: '123456789012345678901',
    });

    const errors = await validate(dto);
    const telefonoError = errors.find((error) => error.property === 'telefono');

    expect(telefonoError).toBeDefined();
  });

  it('acepta un telefono internacional valido', async () => {
    const dto = plainToInstance(CreateContactoEntregaDto, {
      nombre: 'Maria',
      apellido: 'Perez',
      telefono: '+50512345678',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
