import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class InternationalPhoneConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments) {
    // Permite valores vacios para que funcione con campos opcionales.
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    const normalizedValue = value.trim().replace(/[\s()-]+/g, '');

    if (normalizedValue === '') {
      return true;
    }

    // Formato internacional con + opcional, de 8 a 15 digitos.
    return /^\+?[1-9]\d{7,14}$/.test(normalizedValue);
  }

  defaultMessage(args: ValidationArguments) {
    return 'El telefono debe ser valido en formato internacional (ejemplos: +50512345678 o 50512345678).';
  }
}

export function InternationalPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: InternationalPhoneConstraint,
    });
  };
}