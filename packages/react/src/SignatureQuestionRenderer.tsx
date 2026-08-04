import { SignatureQuestion } from '@kajay/core';
import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactElement, RefObject } from 'react';
import type { QuestionRendererProps } from './QuestionRendererProps.js';
import { QuestionErrors } from './QuestionErrors.js';
import { questionErrorId, questionId } from './questionId.js';
import { QuestionTitleContent } from './QuestionTitleContent.js';
import { whenEditable } from './readOnly.js';
import { useQuestionValue } from './useSurveyState.js';
import { useSurveyComponents } from './SurveyComponents.js';

/** The MIME type a format is exported as. SVG is not a canvas format; PNG stands in. */
function mimeTypeOf(format: string): string {
  return format === 'jpeg' ? 'image/jpeg' : 'image/png';
}

/** Where the pointer is, relative to the canvas rather than to the page. */
function positionOf(event: ReactPointerEvent<HTMLCanvasElement>): readonly [number, number] {
  const bounds = event.currentTarget.getBoundingClientRect();
  return [event.clientX - bounds.left, event.clientY - bounds.top];
}

interface PadProps {
  readonly question: SignatureQuestion;
  readonly canvasRef: RefObject<HTMLCanvasElement | null>;
  readonly signature: string;
  readonly errorId: string;
}

/**
 * The canvas itself, and the three handlers that make a stroke.
 *
 * A read-only pad gets no handlers at all rather than handlers that decline: there is
 * nothing to cancel, and a canvas that answered a press by doing nothing would look
 * broken rather than finished.
 */
function createStrokeHandlers(
  question: SignatureQuestion,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  isDrawing: RefObject<boolean>,
): StrokeHandlers {
  return {
    onPointerDown: (event) => {
      const context = canvasRef.current?.getContext('2d');
      if (!context) {
        return;
      }
      // Captured, so a stroke that wanders off the canvas keeps drawing rather than
      // stopping dead at the edge.
      event.currentTarget.setPointerCapture(event.pointerId);
      isDrawing.current = true;
      context.strokeStyle = question.penColor;
      context.lineWidth = 2;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(...positionOf(event));
    },
    onPointerMove: (event) => {
      const context = canvasRef.current?.getContext('2d');
      if (!isDrawing.current || !context) {
        return;
      }
      context.lineTo(...positionOf(event));
      context.stroke();
    },
    onPointerUp: () => {
      const canvas = canvasRef.current;
      if (!isDrawing.current || canvas === null) {
        return;
      }
      isDrawing.current = false;
      question.setSignature(canvas.toDataURL(mimeTypeOf(question.signatureFormat)));
    },
  };
}

interface StrokeHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  readonly onPointerUp: () => void;
}

function SignaturePad({ question, canvasRef, signature, errorId }: PadProps): ReactElement {
  const isDrawing = useRef(false);
  return (
    <canvas
      id={questionId(question)}
      ref={canvasRef}
      className="kajay-signature"
      width={question.signatureWidth}
      height={question.signatureHeight}
      role="img"
      aria-label={
        signature.length > 0
          ? `${question.title}: signed`
          : `${question.title}: ${question.uiText('notSigned')}`
      }
      aria-invalid={question.hasErrors || undefined}
      aria-describedby={question.hasErrors ? errorId : undefined}
      {...(question.isReadOnly ? {} : createStrokeHandlers(question, canvasRef, isDrawing))}
    />
  );
}

/**
 * Paints the stored signature back on, so a re-render does not wipe the canvas.
 *
 * The answer is the truth about what was signed; the canvas is a view of it, and React
 * will happily hand back a blank one after any state change elsewhere on the page.
 */
function repaint(canvas: HTMLCanvasElement | null, signature: string, background: string): void {
  const context = canvas?.getContext('2d');
  if (canvas === null || !context) {
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (background.length > 0) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (signature.length === 0) {
    return;
  }
  const image = new Image();
  image.addEventListener('load', () => {
    context.drawImage(image, 0, 0);
  });
  image.src = signature;
}

/** Erases the pad. Always present: a signature nobody can undo is a trap. */
function ClearButton({ question }: { readonly question: SignatureQuestion }): ReactElement {
  const { Button } = useSurveyComponents();
  return (
    <Button
      type="button"
      className="kajay-signature__clear"
      onClick={whenEditable(question.isReadOnly, () => {
        question.clear();
      })}
    >
      {question.uiText('clearSignature')}
    </Button>
  );
}

/**
 * A signature drawn by hand — checklist H2.
 *
 * Pointer events rather than mouse and touch separately: one set of handlers covers a
 * mouse, a finger and a stylus, and pointer capture is what keeps a stroke attached to
 * the canvas when the hand leaves it mid-line.
 *
 * **Not keyboard-operable, and that is a real gap** rather than an oversight — §J4 owns
 * it, and the answer there is an alternative way to sign rather than a better canvas.
 * The control says what it is and what state it is in so that at least the gap is
 * announced rather than silent.
 */
export function SignatureQuestionRenderer({
  survey,
  question,
}: QuestionRendererProps): ReactElement {
  useQuestionValue(survey, question);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const signature = question instanceof SignatureQuestion ? question.signature : '';
  const background =
    question instanceof SignatureQuestion ? question.backgroundColor : '';

  const restore = useCallback((): void => {
    repaint(canvasRef.current, signature, background);
  }, [signature, background]);

  useEffect(restore, [restore]);

  if (!(question instanceof SignatureQuestion)) {
    return <div className="kajay-question kajay-question--unsupported" />;
  }

  const errorId = questionErrorId(question);

  return (
    <div className="kajay-question kajay-question--signature" data-question-name={question.name}>
      <label className="kajay-question__title" htmlFor={questionId(question)}>
        <QuestionTitleContent question={question} />
      </label>

      <QuestionErrors survey={survey} question={question} at="top" id={errorId} />

      <SignaturePad
        question={question}
        canvasRef={canvasRef}
        signature={signature}
        errorId={errorId}
      />

      <ClearButton question={question} />

      <QuestionErrors survey={survey} question={question} at="bottom" id={errorId} />
    </div>
  );
}
