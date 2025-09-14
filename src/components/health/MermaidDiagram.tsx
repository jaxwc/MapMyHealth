import React, { useEffect, useRef, useState } from 'react';

export function MermaidDiagram({ actionMap, definition }: { actionMap?: any; definition?: string }) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [diagramId] = useState(`mermaid-${Math.random().toString(36).slice(2, 11)}`);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!mermaidRef.current) return;

      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark' });

        let mermaidSyntax = definition || '';
        if (!mermaidSyntax && actionMap?.transitions?.length) {
          mermaidSyntax = 'flowchart TD\n';
          mermaidSyntax += `  Start["${actionMap.root.label}"]\n`;
          actionMap.transitions.forEach((transition: any, index: number) => {
            const actionId = `A${index}`;
            mermaidSyntax += `  ${actionId}["${transition.actionLabel}"]\n`;
            mermaidSyntax += `  Start --> ${actionId}\n`;
            transition.outcomes.forEach((outcome: any, outcomeIndex: number) => {
              const outcomeId = `O${index}_${outcomeIndex}`;
              mermaidSyntax += `  ${outcomeId}["${outcome.label}"]\n`;
              mermaidSyntax += `  ${actionId} --> ${outcomeId}\n`;
              if (outcome.to?.label) {
                const destId = `D${index}_${outcomeIndex}`;
                mermaidSyntax += `  ${destId}["${outcome.to.label}"]\n`;
                mermaidSyntax += `  ${outcomeId} --> ${destId}\n`;
              }
            });
          });
        }

        if (!mermaidSyntax) return;

        mermaidRef.current.innerHTML = '';
        const { svg } = await mermaid.render(diagramId, mermaidSyntax);
        mermaidRef.current.innerHTML = svg;
        const svgElement = mermaidRef.current.querySelector('svg');
        if (svgElement) {
          const svgEl = svgElement as SVGSVGElement;
          svgEl.style.width = '100%';
          svgEl.style.height = 'auto';
          (svgEl.style as any).minHeight = '200px';
        }
      } catch (error) {
        console.error('Error rendering mermaid diagram:', error);
      }
    };

    renderDiagram();
  }, [actionMap, diagramId, definition]);

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 min-h-[200px] overflow-auto">
      <div ref={mermaidRef} className="mermaid-diagram" />
    </div>
  );
}


