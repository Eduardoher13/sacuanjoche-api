import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class AllowedCharactersConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    // Si el valor es undefined, null o string vacío, la validación pasa
    // (esto permite que campos opcionales funcionen correctamente)
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    const allowAddressSymbols = args.constraints[0] === true;
    const allowedPattern = allowAddressSymbols
      ? /^[a-zA-Z0-9\s\-_.,;:()áéíóúÁÉÍÓÚñÑ\/#]+$/
      : /^[a-zA-Z0-9\s\-_.,;:()áéíóúÁÉÍÓÚñÑ]+$/;
    return allowedPattern.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return 'El campo contiene caracteres no permitidos. Solo se permiten letras, números, espacios y caracteres especiales básicos.';
  }
}

export function AllowedCharacters(validationOptions?: ValidationOptions) {
  return createAllowedCharactersDecorator(false, validationOptions);
}

export function AllowedAddressCharacters(
  validationOptions?: ValidationOptions,
) {
  return createAllowedCharactersDecorator(true, validationOptions);
}

function createAllowedCharactersDecorator(
  allowAddressSymbols: boolean,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [allowAddressSymbols],
      validator: AllowedCharactersConstraint,
    });
  };
}
