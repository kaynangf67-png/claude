import consultorioJpg from '../assets/consultorio.jpg';
import consultorioWebp from '../assets/consultorio.webp';
import entradaJpg from '../assets/entrada.jpg';
import entradaWebp from '../assets/entrada.webp';
import balcaoJpg from '../assets/recepcao-balcao.jpg';
import balcaoWebp from '../assets/recepcao-balcao.webp';
import esperaJpg from '../assets/recepcao-sala-de-espera.jpg';
import esperaWebp from '../assets/recepcao-sala-de-espera.webp';
import { clinic } from '../config/clinic';

export interface PhotoAsset {
  jpg: string;
  webp: string;
  width: number;
  height: number;
  alt: string;
}

// Fotos reais da clínica. Dimensões após recorte das bordas da captura de tela.
export const photos = {
  salaDeEspera: {
    jpg: esperaJpg,
    webp: esperaWebp,
    width: 606,
    height: 1111,
    alt: `Recepção e sala de espera da ${clinic.name}, com cadeiras claras, balcão em madeira e parede azul com o logotipo`,
  },
  consultorio: {
    jpg: consultorioJpg,
    webp: consultorioWebp,
    width: 583,
    height: 1071,
    alt: 'Consultório odontológico com cadeira clínica, painel em madeira com iluminação indireta e TV no teto',
  },
  balcao: {
    jpg: balcaoJpg,
    webp: balcaoWebp,
    width: 621,
    height: 1136,
    alt: `Balcão de atendimento em madeira com iluminação embutida e o nome ${clinic.name} na parede azul`,
  },
  entrada: {
    jpg: entradaJpg,
    webp: entradaWebp,
    width: 577,
    height: 1079,
    alt: `Porta de vidro na entrada da ${clinic.name}, com o logotipo e vasos de plantas nas laterais`,
  },
} satisfies Record<string, PhotoAsset>;
