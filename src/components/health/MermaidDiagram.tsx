import React, { useEffect, useRef, useState } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export function MermaidDiagram({ actionMap, definition }: { actionMap?: any; definition?: string }) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidRef.current) return;

      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose' as any,
          flowchart: { useMaxWidth: true, htmlLabels: true } as any,
          themeVariables: {
            background: '#0b1220',
            primaryColor: '#0f172a',
            primaryBorderColor: '#ec4899', // neon pink outline
            primaryTextColor: '#e2e8f0',
            lineColor: '#22d3ee', // neon cyan connectors
            secondaryColor: '#111827',
            tertiaryColor: '#1f2937',
            noteBkgColor: '#0f172a',
            noteTextColor: '#cbd5e1',
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
          } as any,
        });

        const normalizeDefinition = (raw: string) => {
          if (!raw) return '';
          let s = String(raw).trim();
          // If previous fallback text was embedded, strip it and take the actual graph
          const idxFallback = s.indexOf('Could not render diagram. Showing definition:');
          if (idxFallback >= 0) {
            const rest = s.slice(idxFallback + 'Could not render diagram. Showing definition:'.length).trim();
            s = rest;
          }
          // Remove surrounding code fences if present
          if (s.startsWith('```')) {
            // try to extract fenced content
            const m = s.match(/```(?:mermaid)?[\r\n]+([\s\s\S]*?)```/);
            if (m && m[1]) s = m[1].trim();
          }
          // Convert escaped newlines to real newlines
          s = s.replaceAll('\\n', '\n').replaceAll('\r\n', '\n');
          // Trim any stray quotes around the entire string
          if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
            s = s.slice(1, -1);
          }
          return s.trim();
        };

        let mermaidSyntax = definition ? normalizeDefinition(definition) : '';
        if (!mermaidSyntax && actionMap?.transitions?.length) {
          const sanitize = (label: string) =>
            String(label)
              .replaceAll('"', '\\"')
              .replaceAll('[', '(')
              .replaceAll(']', ')');

          mermaidSyntax = 'flowchart TD\n';
          mermaidSyntax += `  Start["${sanitize(actionMap.root.label)}"]\n`;
          actionMap.transitions.forEach((transition: any, index: number) => {
            const actionId = `A${index}`;
            mermaidSyntax += `  ${actionId}["${sanitize(transition.actionLabel)}"]\n`;
            mermaidSyntax += `  Start --> ${actionId}\n`;
            transition.outcomes.forEach((outcome: any, outcomeIndex: number) => {
              const outcomeId = `O${index}_${outcomeIndex}`;
              mermaidSyntax += `  ${outcomeId}["${sanitize(outcome.label)}"]\n`;
              mermaidSyntax += `  ${actionId} --> ${outcomeId}\n`;
              if (outcome.to?.label) {
                const destId = `D${index}_${outcomeIndex}`;
                mermaidSyntax += `  ${destId}["${sanitize(outcome.to.label)}"]\n`;
                mermaidSyntax += `  ${outcomeId} --> ${destId}\n`;
              }
            });
          });
        }

        if (!mermaidSyntax) return;

        // Pre-validate to catch parse errors early and show a graceful fallback
        try {
          await (mermaid as unknown as { parse: (s: string) => Promise<void> }).parse(mermaidSyntax);
        } catch (parseErr) {
          console.warn('Mermaid parse error. Showing fallback.', parseErr);
          mermaidRef.current.innerHTML = `
            <div class="text-slate-300 text-sm">
              <div class="mb-2">Could not render diagram. Showing definition:</div>
              <pre class="bg-slate-800 border border-slate-700 rounded p-3 overflow-auto text-slate-200 whitespace-pre-wrap">${
                mermaidSyntax.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c])
              }</pre>
            </div>
          `;
          return;
        }

        mermaidRef.current.innerHTML = '';
        const { svg } = await mermaid.render(diagramId, mermaidSyntax);
        mermaidRef.current.innerHTML = svg;
        const svgElement = mermaidRef.current.querySelector('svg');
        if (svgElement) {
          const svgEl = svgElement as SVGSVGElement;
          svgEl.style.width = '100%';
          svgEl.style.height = 'auto';
          (svgEl.style as any).minHeight = '200px';
          svgEl.setAttribute('preserveAspectRatio', 'xMinYMin meet');

          // Inject glow filters (cyberpunk style)
          try {
            const ns = 'http://www.w3.org/2000/svg';
            const defs = document.createElementNS(ns, 'defs');

            const makeGlow = (id: string, color: string, stdDev = 2.5) => {
              const filter = document.createElementNS(ns, 'filter');
              filter.setAttribute('id', id);
              filter.setAttribute('x', '-50%');
              filter.setAttribute('y', '-50%');
              filter.setAttribute('width', '200%');
              filter.setAttribute('height', '200%');
              const blur = document.createElementNS(ns, 'feGaussianBlur');
              blur.setAttribute('in', 'SourceGraphic');
              blur.setAttribute('stdDeviation', String(stdDev));
              blur.setAttribute('result', 'blur');
              const colorMatrix = document.createElementNS(ns, 'feColorMatrix');
              colorMatrix.setAttribute('type', 'matrix');
              // tint the blur towards our color
              const r = parseInt(color.slice(1, 3), 16) / 255;
              const g = parseInt(color.slice(3, 5), 16) / 255;
              const b = parseInt(color.slice(5, 7), 16) / 255;
              colorMatrix.setAttribute('values', `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`);
              colorMatrix.setAttribute('result', 'coloredBlur');
              const merge = document.createElementNS(ns, 'feMerge');
              const m1 = document.createElementNS(ns, 'feMergeNode');
              m1.setAttribute('in', 'coloredBlur');
              const m2 = document.createElementNS(ns, 'feMergeNode');
              m2.setAttribute('in', 'SourceGraphic');
              merge.appendChild(m1);
              merge.appendChild(m2);
              filter.appendChild(blur);
              filter.appendChild(colorMatrix);
              filter.appendChild(merge);
              return filter;
            };

            defs.appendChild(makeGlow('glowCyan', '#22d3ee'));
            defs.appendChild(makeGlow('glowPink', '#ec4899', 2.2));
            svgEl.insertBefore(defs, svgEl.firstChild);

            // Style nodes and edges
            const edgePaths = svgEl.querySelectorAll<SVGPathElement>('.edgePath path');
            edgePaths.forEach((p) => {
              p.setAttribute('stroke', '#22d3ee');
              p.setAttribute('stroke-width', '2');
              p.setAttribute('filter', 'url(#glowCyan)');
            });

            const nodes = svgEl.querySelectorAll<SVGElement>('g.node rect, g.node polygon, g.node path');
            nodes.forEach((n) => {
              n.setAttribute('stroke', '#ec4899');
              n.setAttribute('stroke-width', '2');
              n.setAttribute('filter', 'url(#glowPink)');
              // darker fill for contrast
              if (!n.getAttribute('fill') || n.getAttribute('fill') === 'white') {
                n.setAttribute('fill', '#0f172a');
              }
            });

            const labels = svgEl.querySelectorAll<SVGTextElement>('g.node text, .edgeLabel tspan, .label tspan');
            labels.forEach((t) => {
              t.setAttribute('fill', '#e2e8f0');
            });

            // Arrowheads
            const markers = svgEl.querySelectorAll<SVGPathElement>('marker path');
            markers.forEach((m) => {
              m.setAttribute('fill', '#22d3ee');
              m.setAttribute('filter', 'url(#glowCyan)');
            });
          } catch {}
        }
      } catch (error) {
        console.error('Error rendering mermaid diagram:', error);
      }
    };

    renderDiagram();
  }, [actionMap, diagramId, definition]);

  return (
    <ScrollArea className="w-full max-w-full">
      <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 min-h-[200px] w-full max-w-full">
        {/* Ensure content can overflow in both directions for scrolling */}
        <div className="min-w-[720px] min-h-[240px]">
          <div ref={mermaidRef} className="mermaid-diagram" />
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}


