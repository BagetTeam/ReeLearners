import PromptForm from "@/components/PromptForm";
import PromptHistory from "@/components/PromptHistory";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="pt-15">
          <PromptForm />
        </div>

        <section className="flex flex-col gap-3 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Saved prompts
          </h2>
          <div className="scrollbar-none max-h-100 overflow-y-auto pr-1">
            <PromptHistory />
          </div>
        </section>
      </div>
    </div>
  );
}
