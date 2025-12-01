import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class IsDateOnlyConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    // Si el valor es undefined, null o string vacío, la validación pasa
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    // Aceptar formato YYYY-MM-DD
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    // Aceptar formato DD/MM/YYYY
    const ddmmyyyyPattern = /^\d{2}\/\d{2}\/\d{4}$/;

    let date: Date;
    let year: number, month: number, day: number;

    if (isoPattern.test(value)) {
      // Formato YYYY-MM-DD
      [year, month, day] = value.split('-').map(Number);
      date = new Date(year, month - 1, day);
    } else if (ddmmyyyyPattern.test(value)) {
      // Formato DD/MM/YYYY
      const parts = value.split('/');
      day = Number(parts[0]);
      month = Number(parts[1]);
      year = Number(parts[2]);
      date = new Date(year, month - 1, day);
    } else {
      return false;
    }

    // Validar que sea una fecha válida
    if (isNaN(date.getTime())) {
      return false;
    }

    // Verificar que la fecha parseada coincida con los valores originales
    if (
      date.getFullYear() !== year ||
      date.getMonth() + 1 !== month ||
      date.getDate() !== day
    ) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'La fecha debe tener el formato YYYY-MM-DD (ejemplo: 2024-12-25) o DD/MM/YYYY (ejemplo: 25/12/2024)';
  }
}

export function IsDateOnly(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDateOnlyConstraint,
    });
  };
}

