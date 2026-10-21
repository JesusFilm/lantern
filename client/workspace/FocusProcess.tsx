import { useId } from "react";
import { ArrowDown, ArrowRight, FileText, LockKeyhole, MessagesSquare } from "lucide-react";

export function FocusProcess() {
  const id = useId();
  return (
    <figure className="focus-process" aria-label="A typical position focus process">
      <div className="process-graphic">
        <ol role="list" className="process-stages">
          <li><FileText aria-hidden="true" /><span>Prepare a small draft</span></li>
          <li><MessagesSquare aria-hidden="true" /><span>Talk it through together</span></li>
          <li><LockKeyhole aria-hidden="true" /><span>Agree, then confirm</span></li>
        </ol>
        <span className="process-forward process-first" aria-hidden="true"><ArrowRight /><ArrowDown /></span>
        <span className="process-forward process-agreed"><span>Once agreed</span><ArrowRight aria-hidden="true" /><ArrowDown aria-hidden="true" /></span>
        <svg className="process-return process-return-wide" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id={id + "-wide"} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L4 4 L1 7" /></marker></defs>
          <path d="M250 2 Q250 25 210 25 H90 Q50 25 50 2" markerEnd={`url(#${id}-wide)`} />
        </svg>
        <svg className="process-return process-return-narrow" viewBox="0 0 32 200" preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id={id + "-narrow"} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1 1 L4 4 L1 7" /></marker></defs>
          <path d="M29 170 H17 Q4 170 4 157 V43 Q4 30 17 30 H29" markerEnd={`url(#${id}-narrow)`} />
        </svg>
        <span className="process-refine-label">Refine before confirming</span>
      </div>
      <figcaption className="visually-hidden">Discuss your draft with your career lead and refine it together as needed. Once you agree, your career lead confirms and locks the focus.</figcaption>
    </figure>
  );
}
