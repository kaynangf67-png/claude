import { site } from '../config/site';

/**
 * Fotos do site, lidas automaticamente da pasta src/assets/fotos/.
 *
 * Para adicionar ou trocar uma foto, basta salvar o arquivo com o nome
 * abaixo (jpg, jpeg, png ou webp) e rodar a build de novo:
 *
 *   hero.*        Foto principal (aula prática, carro da autoescola). Vertical ou quadrada.
 *   autoescola.*  Fachada, recepção ou equipe.
 *   cursos.*      Imagem da seção de cursos.
 *   final.*       Fundo da chamada final (fica escurecida). Horizontal.
 *   aprovados/*   Alunos aprovados, uma foto por arquivo, com autorização de uso de imagem.
 *                 A legenda é o nome do arquivo: "maria-categoria-b.jpg" vira "Maria · Categoria B".
 *
 * Sem a foto, cada seção usa uma composição gráfica própria (nunca um banco de imagens genérico).
 * Prefira arquivos com até 1600 px no lado maior e menos de 400 KB.
 */

export interface PhotoAsset {
  src: string;
  alt: string;
}

const single = import.meta.glob<string>('../assets/fotos/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
});
const approved = import.meta.glob<string>('../assets/fotos/aprovados/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
});

const baseName = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '');

function pick(name: string, alt: string): PhotoAsset | null {
  const entry = Object.entries(single).find(([path]) => baseName(path).toLowerCase() === name);
  return entry ? { src: entry[1], alt } : null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "maria-categoria-b" → "Maria · Categoria B" */
function captionFromFile(name: string): string {
  const words = name.replace(/^\d+[-_ ]*/, '').split(/[-_ ]+/).filter(Boolean);
  const idx = words.findIndex((w) => w.toLowerCase() === 'categoria');
  if (idx === -1) return words.map(capitalize).join(' ');
  const person = words.slice(0, idx).map(capitalize).join(' ');
  const category = `Categoria ${words.slice(idx + 1).join(' + ').toUpperCase()}`;
  return [person, category].filter(Boolean).join(' · ');
}

export const photos = {
  hero: pick('hero', `Aula prática de direção na ${site.name}`),
  about: pick('autoescola', `Equipe e estrutura da ${site.name}, em Serra, ES`),
  courses: pick('cursos', `Curso na ${site.name}`),
  final: pick('final', ''),
};

export const approvedPhotos = Object.entries(approved)
  .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
  .map(([path, src]) => {
    const caption = captionFromFile(baseName(path));
    return { src, caption, alt: `${caption || 'Aluno aprovado'} na ${site.name}` };
  });
