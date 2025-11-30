import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { NoSqlInjection } from '../../common/validators/no-sql-injection.decorator';

export class LoginUserDto {
    @ApiProperty({ description: 'Email del usuario', example: 'juanito32@gmail.com' })
    @IsString()
    @IsEmail({}, { message: 'El correo electrónico no es válido' })
    @MaxLength(100, { message: 'El email no puede exceder 100 caracteres' })
    @Matches(
        /^[a-zA-Z0-9._%+-]{6,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        {
            message: 'El correo debe tener al menos 6 caracteres antes del @'
        }
    )
    @NoSqlInjection()
    email: string;

    @ApiProperty({ description: 'Contraseña del usuario', example: 'Juanito1234' })
    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    @MaxLength(50, { message: 'La contraseña no puede exceder 50 caracteres' })
    @Matches(
        /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,
        {
            message: 'La contraseña debe tener al menos una mayúscula, una minúscula y un número'
        }
    )
    password: string;
}