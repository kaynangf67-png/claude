"""Gera M1Retracao.mq5 a partir de M5Retracao.mq5 (mesmo motor, tempo grafico M1).

Uso: python3 mql5/gerar-m1.py   (rode sempre que mudar o M5Retracao)
O M1 e EXPERIMENTAL: as regras das aulas sao de M5; aqui os mesmos criterios
rodam em velas de 1 minuto, com o gatilho proporcional (30 s = metade da vela).
"""
from pathlib import Path

DIR = Path(__file__).parent
TROCAS = [
    ('#define TF      PERIOD_M5', '#define TF      PERIOD_M1'),
    ('#define TFSEC   300', '#define TFSEC   60'),
    ('#define TFNAME  "M5"', '#define TFNAME  "M1"'),
    ('#define CSVPFX  "m5sinais_"', '#define CSVPFX  "m1sinais_"'),
    ('#define PFX "M5R_"', '#define PFX "M1R_"'),
    ('#define SPFX "M5RS_"', '#define SPFX "M1RS_"'),
    ('input int    InpMinRemaining  = 150;   // Tempo restante minimo em segundos (aula 3: 2:30)',
     'input int    InpMinRemaining  = 30;    // Tempo restante minimo em segundos (metade da vela M1; SEM base em aula)'),
    ('//| M5Retracao.mq5                                                    |',
     '//| M1Retracao.mq5  (GERADO de M5Retracao.mq5 por gerar-m1.py)        |'),
    ('//| Indicador da retracao M5 (aulas 1 a 3) direto no grafico do MT5. |',
     '//| EXPERIMENTAL: o motor do M5 rodando em M1. As regras das aulas   |\n'
     '//| sao de M5; em M1 os valores NAO tem base e o acerto e incerto.   |'),
    ('#property description "Retracao M5: zonas e sinal (somente leitura, sem ordens). Nao garante resultado."',
     '#property description "Retracao M1 EXPERIMENTAL (somente leitura, sem ordens). Regras sem base em aula. Nao garante resultado."'),
]


def gerar() -> str:
    s = (DIR / 'M5Retracao.mq5').read_text(encoding='utf-8')
    for a, b in TROCAS:
        if s.count(a) != 1:
            raise SystemExit(f'trecho nao encontrado (ou repetido) no M5Retracao: {a!r}')
        s = s.replace(a, b)
    return s


if __name__ == '__main__':
    (DIR / 'M1Retracao.mq5').write_text(gerar(), encoding='utf-8')
    print('M1Retracao.mq5 gerado')
