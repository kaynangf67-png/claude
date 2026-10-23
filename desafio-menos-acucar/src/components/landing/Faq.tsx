import { ChevronDown } from "lucide-react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "O que é a Primeira Turma? Quanto custa?",
    a: "É a turma de testes do desafio, gratuita. Você faz os 21 dias sem pagar nada e responde, se quiser, três pesquisas curtas para ajudar a melhorar o produto. Não pedimos cartão e não há cobrança no fim. Uma versão paga pode existir no futuro, mas participar agora não te compromete com ela.",
  },
  {
    q: "Por que dizem que é uma versão em construção?",
    a: "Porque é. O conteúdo está completo, mas algumas partes do app podem mudar durante a turma, e pode aparecer algum problema. Se acontecer, use “Fale com a gente” no seu Perfil.",
  },
  {
    q: "Preciso parar de comer doce?",
    a: "Não. O desafio não proíbe nenhum alimento. A proposta é entender quando e por que o doce aparece na sua rotina e testar ajustes que façam sentido para você. Comer um doce continua sendo uma escolha válida.",
  },
  {
    q: "Quanto tempo leva por dia?",
    a: "Cada missão tem uma versão completa, de 5 a 20 minutos, e uma versão rápida, que cabe em poucos minutos. No questionário inicial você informa quanto tempo tem e o app destaca a versão mais adequada.",
  },
  {
    q: "E se eu perder um dia?",
    a: "Nada acontece. Uma nova missão é liberada a cada dia, e as anteriores continuam disponíveis. Você não perde progresso nem XP por fazer uma missão atrasada.",
  },
  {
    q: "Vou emagrecer ou ficar mais saudável?",
    a: "Não fazemos essa promessa. O desafio é educativo e trabalha percepção e hábitos. Resultados de saúde dependem de muitos fatores e devem ser acompanhados por profissionais. Se você tem diabetes, outra condição de saúde, histórico de transtorno alimentar ou está gestante, converse com seu médico ou nutricionista antes de mudar sua alimentação.",
  },
  {
    q: "O desafio substitui acompanhamento com nutricionista?",
    a: "Não. Ele pode ser um complemento para o dia a dia, mas não oferece diagnóstico, plano alimentar individual nem tratamento.",
  },
  {
    q: "Quais dados vocês pedem?",
    a: "Nome, e-mail, as respostas do questionário inicial e das pesquisas, e o seu progresso. Não pedimos telefone, peso, exames, diagnóstico ou outros dados de saúde. Receber novidades por e-mail é opcional e separado da participação. Os detalhes estão no aviso de privacidade.",
  },
  {
    q: "Funciona no celular?",
    a: "Sim. O app foi pensado primeiro para o celular e funciona no navegador, sem instalar nada. No computador ele também funciona normalmente.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-card border border-line bg-white">
      {ITEMS.map((item) => (
        <details key={item.q} className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-ink">
            {item.q}
            <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="pb-5 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
