// Países (ISO 3166-1 alfa-2) com continente para os rankings regionais.
const RAW = `BR|Brasil|SA,AR|Argentina|SA,BO|Bolívia|SA,CL|Chile|SA,CO|Colômbia|SA,EC|Equador|SA,GY|Guiana|SA,PY|Paraguai|SA,PE|Peru|SA,SR|Suriname|SA,UY|Uruguai|SA,VE|Venezuela|SA,
US|Estados Unidos|NA,CA|Canadá|NA,MX|México|NA,GT|Guatemala|NA,HN|Honduras|NA,SV|El Salvador|NA,NI|Nicarágua|NA,CR|Costa Rica|NA,PA|Panamá|NA,CU|Cuba|NA,DO|República Dominicana|NA,HT|Haiti|NA,JM|Jamaica|NA,PR|Porto Rico|NA,TT|Trinidad e Tobago|NA,BS|Bahamas|NA,
PT|Portugal|EU,ES|Espanha|EU,FR|França|EU,DE|Alemanha|EU,IT|Itália|EU,GB|Reino Unido|EU,IE|Irlanda|EU,NL|Países Baixos|EU,BE|Bélgica|EU,LU|Luxemburgo|EU,CH|Suíça|EU,AT|Áustria|EU,DK|Dinamarca|EU,NO|Noruega|EU,SE|Suécia|EU,FI|Finlândia|EU,IS|Islândia|EU,PL|Polônia|EU,CZ|Tchéquia|EU,SK|Eslováquia|EU,HU|Hungria|EU,RO|Romênia|EU,BG|Bulgária|EU,GR|Grécia|EU,HR|Croácia|EU,SI|Eslovênia|EU,RS|Sérvia|EU,BA|Bósnia e Herzegovina|EU,ME|Montenegro|EU,MK|Macedônia do Norte|EU,AL|Albânia|EU,UA|Ucrânia|EU,BY|Bielorrússia|EU,MD|Moldávia|EU,LT|Lituânia|EU,LV|Letônia|EU,EE|Estônia|EU,RU|Rússia|EU,MT|Malta|EU,CY|Chipre|EU,
CN|China|AS,JP|Japão|AS,KR|Coreia do Sul|AS,KP|Coreia do Norte|AS,TW|Taiwan|AS,HK|Hong Kong|AS,MN|Mongólia|AS,IN|Índia|AS,PK|Paquistão|AS,BD|Bangladesh|AS,LK|Sri Lanka|AS,NP|Nepal|AS,ID|Indonésia|AS,MY|Malásia|AS,SG|Singapura|AS,TH|Tailândia|AS,VN|Vietnã|AS,PH|Filipinas|AS,KH|Camboja|AS,LA|Laos|AS,MM|Mianmar|AS,TR|Turquia|AS,IR|Irã|AS,IQ|Iraque|AS,SA|Arábia Saudita|AS,AE|Emirados Árabes Unidos|AS,QA|Catar|AS,KW|Kuwait|AS,IL|Israel|AS,JO|Jordânia|AS,LB|Líbano|AS,SY|Síria|AS,KZ|Cazaquistão|AS,UZ|Uzbequistão|AS,AZ|Azerbaijão|AS,GE|Geórgia|AS,AM|Armênia|AS,AF|Afeganistão|AS,
ZA|África do Sul|AF,NG|Nigéria|AF,EG|Egito|AF,MA|Marrocos|AF,DZ|Argélia|AF,TN|Tunísia|AF,KE|Quênia|AF,ET|Etiópia|AF,GH|Gana|AF,CI|Costa do Marfim|AF,SN|Senegal|AF,CM|Camarões|AF,AO|Angola|AF,MZ|Moçambique|AF,CV|Cabo Verde|AF,GW|Guiné-Bissau|AF,ST|São Tomé e Príncipe|AF,TZ|Tanzânia|AF,UG|Uganda|AF,RW|Ruanda|AF,CD|Rep. Dem. do Congo|AF,ZW|Zimbábue|AF,ZM|Zâmbia|AF,
AU|Austrália|OC,NZ|Nova Zelândia|OC,FJ|Fiji|OC,PG|Papua-Nova Guiné|OC,TL|Timor-Leste|AS`;

export const COUNTRIES = RAW.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
  const [code, name, continent] = s.split('|');
  return { code, name, continent };
}).sort((a, b) => a.name.localeCompare(b.name, 'pt'));

export const COUNTRY_MAP = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export const CONTINENTS = {
  SA: 'América do Sul', NA: 'América do Norte e Central', EU: 'Europa', AS: 'Ásia', AF: 'África', OC: 'Oceania',
};

export function flagEmoji(code) {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}
