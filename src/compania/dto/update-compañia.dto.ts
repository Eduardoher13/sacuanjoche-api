import { PartialType } from '@nestjs/swagger';
import { CreateCompaniaDto } from './create-compañia.dto';

export class UpdateCompaniaDto extends PartialType(CreateCompaniaDto) {}
