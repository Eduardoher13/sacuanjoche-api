import { validate } from 'class-validator';
import {
  AllowedAddressCharacters,
  AllowedCharacters,
} from './allowed-characters.decorator';
import { ForwardGeocodeQueryDto } from '../google-maps/dto/forward-geocode-query.dto';

class AddressDto {
  @AllowedAddressCharacters()
  value: string;
}

class GeneralTextDto {
  @AllowedCharacters()
  value: string;
}

describe('AllowedAddressCharacters', () => {
  it('accepts a realistic address in the geocoding query DTO', async () => {
    const dto = Object.assign(new ForwardGeocodeQueryDto(), {
      query:
        'SEMAFOROS DE LINDA VISTA 4C AL LAGO AL TOPE 1 1/2 ABAJO A MANO IZQUIERDA CASA COLOR AZUL.',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('continues rejecting SQL comment patterns in address queries', async () => {
    const dto = Object.assign(new ForwardGeocodeQueryDto(), {
      query: 'direccion /* comentario */',
    });

    const errors = await validate(dto);

    expect(errors.some((error) => error.property === 'query')).toBe(true);
  });

  it('accepts slash and hash in address text', async () => {
    const dto = new AddressDto();
    dto.value = '2 1/2 cuadra al este, casa #10';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('continues rejecting other unsupported characters in addresses', async () => {
    const dto = new AddressDto();
    dto.value = 'Casa #10 <script>';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
  });

  it('does not allow slash or hash in general text fields', async () => {
    const slashDto = new GeneralTextDto();
    slashDto.value = '1/2';
    const hashDto = new GeneralTextDto();
    hashDto.value = 'Casa #10';

    await expect(validate(slashDto)).resolves.toHaveLength(1);
    await expect(validate(hashDto)).resolves.toHaveLength(1);
  });
});
