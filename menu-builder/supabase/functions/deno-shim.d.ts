// Só para checar tipos da Edge Function com o TypeScript do Node (o runtime real é Deno).
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};
