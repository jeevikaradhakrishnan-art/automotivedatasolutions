import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { CAPABILITIES } from "@/data/capabilities";

export const Route = createFileRoute("/_app/capabilities/")({ component: CapabilitiesLanding });

function CapabilitiesLanding() {
  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-[10px] font-mono tracking-widest text-muted-foreground">XDAS · USE-CASES</div>
        <h1 className="text-2xl font-semibold tracking-tight mt-1 flex items-center gap-2">
          <Sparkles className="size-5 text-primary" /> What we've delivered for customers
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Real customer engagements across mobility data — anonymized. Click any card for the full case.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAPABILITIES.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.id}
              to="/capabilities/$id"
              params={{ id: c.id }}
              className="panel flex flex-col gap-0 hover:border-cyan/40 transition group relative overflow-hidden"
            >
              {/* Image */}
              <div className="relative h-40 overflow-hidden border-b border-border">
                <img
                  src={c.image}
                  alt={c.title}
                  width={1024}
                  height={640}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/10 to-transparent" />
                <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br ${c.accent} opacity-40 group-hover:opacity-70 transition blur-2xl`} />
                <div className="absolute top-3 left-3 size-9 rounded-md bg-background/80 backdrop-blur border border-cyan/30 grid place-items-center">
                  <Icon className="size-4 text-cyan" />
                </div>
              </div>
              <div className="p-5 flex flex-col gap-3 flex-1">
                <div>
                  <div className="text-[10px] font-mono tracking-widest text-muted-foreground">CASE STUDY</div>
                  <h3 className="text-base font-semibold mt-0.5">{c.title}</h3>
                  <p className="text-[11px] font-mono text-muted-foreground mt-1.5">{c.customerProfile}</p>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                    {c.oneLiner}
                  </p>
                </div>
                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono">
                  <span className="text-muted-foreground">{c.metrics.length} key metrics · {c.outputColumns.length} fields</span>
                  <span className="text-cyan flex items-center gap-1">OPEN <ArrowRight className="size-3" /></span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
