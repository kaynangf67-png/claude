import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/app/AuthShell";
import { env } from "@/lib/env";
import { TERMS_VERSION } from "@/services/backend";

export const metadata: Metadata = { title: "Aviso de privacidade" };

// Linguagem simples e só o que o sistema realmente faz. Mudou o texto? Suba TERMS_VERSION.
export default function PrivacyPage() {
  return (
    <AuthShell
      title="Aviso de privacidade"
      subtitle="Primeira Turma do Desafio Menos Açúcar (versão beta)."
      footer={
        <Link href="/" className="font-semibold text-forest hover:underline">
          Voltar para o início
        </Link>
      }
    >
      <div className="grid gap-6 text-[0.9375rem] leading-relaxed text-ink [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-forest [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">
        <section>
          <h2>O que coletamos</h2>
          <ul>
            <li>Nome (como você quer ser chamado) e e-mail, para criar e acessar sua conta.</li>
            <li>Suas respostas ao questionário inicial (objetivo, horários, dificuldades, preferências e orçamento aproximado).</li>
            <li>Seu progresso: missões concluídas, como foi cada uma, reflexões que você escrever e estratégias salvas.</li>
            <li>Suas respostas às pesquisas da Primeira Turma e mensagens que você enviar pelo “Fale com a gente”.</li>
          </ul>
          <p className="mt-2">Não pedimos telefone, peso, exames, diagnósticos ou outros dados de saúde. Evite escrevê-los nas reflexões e pesquisas.</p>
        </section>
        <section>
          <h2>Para que usamos</h2>
          <ul>
            <li>Fazer o desafio funcionar: liberar missões, salvar seu progresso e personalizar dicas.</li>
            <li>Melhorar o produto: o fundador vê números agregados e lê as respostas das pesquisas, identificadas só pelo primeiro nome.</li>
            <li>Enviar novidades sobre versões futuras, <strong>somente se você marcar essa opção</strong>. Ela é separada da participação e pode ser desligada no Perfil.</li>
          </ul>
          <p className="mt-2">Não vendemos seus dados e não usamos suas respostas para anúncios.</p>
        </section>
        <section>
          <h2>Onde ficam</h2>
          <p>
            Os dados ficam num banco de dados do Supabase hospedado em São Paulo, com regras que impedem um participante de ver os dados de outro. O
            site é hospedado na Vercel, que registra dados técnicos de acesso (como endereço IP) para operar o serviço.
          </p>
        </section>
        <section>
          <h2>Seus direitos</h2>
          <p>
            Você pode pedir acesso, correção ou exclusão dos seus dados, e retirar consentimentos a qualquer momento. No app, use{" "}
            <strong>Perfil → Fale com a gente → Meus dados / privacidade</strong>
            {env.contactEmail ? (
              <>
                {" "}
                ou escreva para{" "}
                <a className="font-semibold text-forest underline" href={`mailto:${env.contactEmail}`}>
                  {env.contactEmail}
                </a>
              </>
            ) : null}
            . Em Perfil você também pode apagar seu progresso a qualquer momento.
          </p>
        </section>
        <section>
          <h2>Sobre o conteúdo</h2>
          <p>
            O desafio é educativo e não substitui médicos, nutricionistas ou outros profissionais. Se você tem diabetes, outra condição de saúde,
            histórico de transtorno alimentar ou está gestante, procure orientação antes de mudar sua alimentação. A participação é só para maiores
            de 18 anos.
          </p>
        </section>
        <p className="text-xs text-muted">Versão {TERMS_VERSION}. Esta é uma versão beta e este aviso pode ser atualizado; mudanças relevantes serão informadas no app.</p>
      </div>
    </AuthShell>
  );
}
