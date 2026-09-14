import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-16 md:px-10">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-medium text-muted-foreground">Yakable Base</p>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              A stable frontend foundation.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              Runtime, styles, aliases, and minimal UI primitives are ready. Product code starts here.
            </p>
          </div>
          <div className="flex max-w-md flex-col gap-3 sm:flex-row">
            <Input aria-label="Example input" placeholder="Project-owned content" />
            <Button type="button">Base ready</Button>
          </div>
        </div>
      </section>
    </main>
  );
}
