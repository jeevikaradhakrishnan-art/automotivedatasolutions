import { createFileRoute } from "@tanstack/react-router";
import { SolutionCard } from "@/components/solutions/SolutionCard";
import { useEffectiveSolutions } from "@/hooks/useSolutionOverrides";

export const Route = createFileRoute("/_app/")({ component: SolutionsLanding });

function SolutionsLanding() {
  const solutions = useEffectiveSolutions();
  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground">XDAS · MOBILITY INTELLIGENCE HUB</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Automotive Data Solutions</h1>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Activate a use case, configure its workflows, run jobs against trusted sources and ship
          review-gated, customer-ready data straight into your stack.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {solutions.map((s) => <SolutionCard key={s.id} s={s} />)}
      </div>
    </div>
  );
}
