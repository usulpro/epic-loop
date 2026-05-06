'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Play, RotateCcw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type GameStatus = 'idle' | 'running' | 'game-over';
type ObstacleKind = 'block' | 'signal' | 'stack';

interface FooterMiniGameProps {
  className?: string;
}

interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  kind: ObstacleKind;
}

const RUNNER_X = 13;
const RUNNER_WIDTH = 5.8;
const GROUND_OFFSET = 16;
const MAX_FRAME_DELTA = 34;
const BASE_SPEED = 0.034;
const SCORE_PER_MS = 0.014;
const JUMP_VELOCITY = 0.58;
const GRAVITY = 0.00215;

const OBSTACLE_PATTERN: ReadonlyArray<{
  width: number;
  height: number;
  delay: number;
  kind: ObstacleKind;
}> = [
  { width: 3.5, height: 25, delay: 760, kind: 'block' },
  { width: 4.2, height: 31, delay: 980, kind: 'stack' },
  { width: 2.9, height: 36, delay: 840, kind: 'signal' },
  { width: 5.2, height: 22, delay: 1060, kind: 'block' },
];

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}

function getStatusLabel(status: GameStatus) {
  if (status === 'running') {
    return 'Running';
  }

  if (status === 'game-over') {
    return 'Game over';
  }

  return 'Ready';
}

function getObstacleClassName(kind: ObstacleKind) {
  if (kind === 'signal') {
    return 'border-primary/30 bg-primary/15 dark:bg-primary/20';
  }

  if (kind === 'stack') {
    return 'border-secondary-foreground/20 bg-secondary text-secondary-foreground';
  }

  return 'border-border bg-background text-primary';
}

function RunnerAvatar({ runnerY, status }: { runnerY: number; status: GameStatus }) {
  const isCrashed = status === 'game-over';

  return (
    <div
      className="absolute z-20 h-9 w-8 will-change-transform"
      style={{
        bottom: GROUND_OFFSET,
        left: `${RUNNER_X}%`,
        transform: `translate3d(0, -${runnerY}px, 0)`,
      }}
      aria-hidden
    >
      <div
        className={cn(
          'absolute right-0 bottom-0 h-7 w-6 rounded-md border shadow-[0_9px_18px_rgba(15,23,42,0.12)] transition-colors',
          isCrashed ? 'border-destructive/40 bg-destructive/10' : 'border-primary/35 bg-background',
        )}
      />
      <div
        className={cn(
          'absolute right-1 bottom-5 size-2 rounded-sm transition-colors',
          isCrashed ? 'bg-destructive' : 'bg-primary',
        )}
      />
      <div className="absolute bottom-1 left-1 h-2 w-5 rounded-sm bg-foreground/80" />
      <div className="absolute bottom-0 left-0 h-1 w-3 rounded-sm bg-primary/70" />
      <div className="absolute right-0 bottom-0 h-1 w-3 rounded-sm bg-primary/70" />
    </div>
  );
}

function ObstacleShape({ obstacle }: { obstacle: Obstacle }) {
  return (
    <div
      className={cn(
        'absolute z-10 overflow-hidden rounded-sm border shadow-[0_8px_16px_rgba(15,23,42,0.08)]',
        getObstacleClassName(obstacle.kind),
      )}
      style={{
        bottom: GROUND_OFFSET,
        height: obstacle.height,
        left: `${obstacle.x}%`,
        width: `${obstacle.width}%`,
      }}
      aria-hidden
    >
      <span className="absolute inset-x-1 top-1 h-px rounded-full bg-current/35" />
      {obstacle.kind === 'stack' && (
        <span className="absolute inset-x-1 top-1/2 h-px rounded-full bg-current/25" />
      )}
      {obstacle.kind === 'signal' && (
        <span className="absolute top-2 right-1 size-1 rounded-full bg-primary" />
      )}
    </div>
  );
}

function FooterMiniGame({ className }: FooterMiniGameProps) {
  const statusId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [status, setStatus] = useState<GameStatus>('idle');
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [runnerY, setRunnerY] = useState(0);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);
  const runnerYRef = useRef(0);
  const runnerVelocityRef = useRef(0);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const statusRef = useRef<GameStatus>('idle');
  const scoreRef = useRef(0);
  const scoreProgressRef = useRef(0);
  const spawnTimerRef = useRef(620);
  const obstacleIdRef = useRef(0);
  const obstaclePatternIndexRef = useRef(0);

  const trackTicks = useMemo(() => Array.from({ length: 18 }, (_, index) => index), []);
  const statusLabel = getStatusLabel(status);

  const accessibleStatus = useMemo(() => {
    if (status === 'game-over') {
      return `Prime Runner game over. Score ${score}. Best score ${bestScore}.`;
    }

    if (status === 'running') {
      return `Prime Runner running. Score ${score}.`;
    }

    return `Prime Runner ready. Best score ${bestScore}.`;
  }, [bestScore, score, status]);

  const setGameStatus = useCallback((nextStatus: GameStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const resetRuntimeState = useCallback(() => {
    runnerYRef.current = 0;
    runnerVelocityRef.current = 0;
    obstaclesRef.current = [];
    scoreRef.current = 0;
    scoreProgressRef.current = 0;
    spawnTimerRef.current = 620;
    obstaclePatternIndexRef.current = 0;
    setRunnerY(0);
    setObstacles([]);
    setScore(0);
  }, []);

  const startRun = useCallback(() => {
    resetRuntimeState();
    setGameStatus('running');
  }, [resetRuntimeState, setGameStatus]);

  const finishRun = useCallback(() => {
    setBestScore((currentBest) => Math.max(currentBest, scoreRef.current));
    setGameStatus('game-over');
  }, [setGameStatus]);

  const jump = useCallback(() => {
    if (statusRef.current !== 'running') {
      startRun();
      return;
    }

    if (runnerYRef.current <= 2) {
      runnerVelocityRef.current = JUMP_VELOCITY;
      runnerYRef.current = 1;
      setRunnerY(1);
    }
  }, [startRun]);

  const handleTrackKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== ' ' && event.key !== 'ArrowUp') {
        return;
      }

      event.preventDefault();
      jump();
    },
    [jump],
  );

  const handleTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      event.currentTarget.focus();
      jump();
    },
    [jump],
  );

  useEffect(() => {
    if (status !== 'running') {
      return;
    }

    lastFrameRef.current = performance.now();

    const tick = (timestamp: number) => {
      if (statusRef.current !== 'running') {
        return;
      }

      const delta = Math.min(timestamp - lastFrameRef.current, MAX_FRAME_DELTA);
      lastFrameRef.current = timestamp;

      const nextVelocity = runnerVelocityRef.current - GRAVITY * delta;
      const nextRunnerY = Math.max(0, runnerYRef.current + nextVelocity * delta);
      runnerVelocityRef.current = nextRunnerY === 0 ? 0 : nextVelocity;
      runnerYRef.current = nextRunnerY;
      setRunnerY(nextRunnerY);

      scoreProgressRef.current += delta * SCORE_PER_MS;
      const nextScore = Math.floor(scoreProgressRef.current);

      if (nextScore !== scoreRef.current) {
        scoreRef.current = nextScore;
        setScore(nextScore);
      }

      const speed = BASE_SPEED + Math.min(scoreRef.current, 240) * 0.000025;
      let nextObstacles = obstaclesRef.current
        .map((obstacle) => ({
          ...obstacle,
          x: obstacle.x - speed * delta,
        }))
        .filter((obstacle) => obstacle.x + obstacle.width > -4);

      spawnTimerRef.current -= delta;

      if (spawnTimerRef.current <= 0) {
        const pattern = OBSTACLE_PATTERN[obstaclePatternIndexRef.current % OBSTACLE_PATTERN.length];
        obstaclePatternIndexRef.current += 1;
        spawnTimerRef.current += pattern.delay;
        nextObstacles = [
          ...nextObstacles,
          {
            id: obstacleIdRef.current,
            x: 104,
            width: pattern.width,
            height: pattern.height,
            kind: pattern.kind,
          },
        ];
        obstacleIdRef.current += 1;
      }

      obstaclesRef.current = nextObstacles;
      setObstacles(nextObstacles);

      const runnerLeft = RUNNER_X;
      const runnerRight = RUNNER_X + RUNNER_WIDTH;
      const hasCollision = nextObstacles.some((obstacle) => {
        const obstacleLeft = obstacle.x;
        const obstacleRight = obstacle.x + obstacle.width;
        const overlapsHorizontally = obstacleLeft < runnerRight && obstacleRight > runnerLeft;
        const overlapsVertically = nextRunnerY < obstacle.height - 6;

        return overlapsHorizontally && overlapsVertically;
      });

      if (hasCollision) {
        finishRun();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [finishRun, status]);

  return (
    <section
      className={cn('w-full min-w-0', className)}
      data-footer-mini-game
      data-game-status={status}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
          <p className="text-sm leading-none font-medium tracking-tight text-foreground">
            Prime Runner
          </p>
          <span
            className={cn(
              'rounded-sm border px-2 py-1 text-[0.6875rem] leading-none font-medium tracking-normal',
              status === 'idle' &&
                'border-secondary-foreground/15 bg-secondary text-secondary-foreground',
              status === 'running' && 'border-primary/20 bg-primary/10 text-foreground',
              status === 'game-over' && 'border-destructive/25 bg-destructive/10 text-destructive',
            )}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[0.8125rem] leading-none tracking-tight text-muted-foreground">
            <span>Score {score}</span>
            <span className="h-3 w-px bg-border" aria-hidden />
            <span>Best {bestScore}</span>
          </div>
          {status !== 'running' && (
            <Button
              className="h-7 gap-x-1.5 px-2.5 text-[0.75rem] [&_svg]:size-3.5"
              size="sm"
              variant={status === 'game-over' ? 'secondary' : 'outline'}
              type="button"
              onClick={startRun}
            >
              {status === 'game-over' ? <RotateCcw size={14} /> : <Play size={14} />}
              {status === 'game-over' ? 'Retry' : 'Start'}
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          'relative h-24 overflow-hidden rounded-md border border-border bg-background transition-colors outline-none',
          'bg-[linear-gradient(180deg,hsl(var(--accent)/0.32),hsl(var(--background))_58%),linear-gradient(90deg,hsl(var(--primary)/0.08),transparent_34%,hsl(var(--secondary)/0.42))]',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          status !== 'game-over' && 'cursor-pointer',
          status === 'game-over' && 'border-destructive/30',
        )}
        role="button"
        tabIndex={0}
        aria-describedby={statusId}
        aria-label="Prime Runner game surface. Use Space or Arrow Up to jump."
        onKeyDown={handleTrackKeyDown}
        onPointerDown={handleTrackPointerDown}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/20"
          aria-hidden
        />
        <div className="absolute inset-x-4 bottom-[22px] h-px bg-border" aria-hidden />
        <div
          className="absolute inset-x-4 bottom-[14px] flex justify-between opacity-70"
          aria-hidden
        >
          {trackTicks.map((tick) => (
            <span key={tick} className="h-1 w-4 rounded-full bg-secondary-foreground/20" />
          ))}
        </div>
        <div
          className="absolute top-3 right-4 left-4 flex items-center justify-between"
          aria-hidden
        >
          <span className="h-1 w-12 rounded-full bg-primary/30" />
          <span className="h-1 w-7 rounded-full bg-secondary-foreground/20" />
          <span className="h-1 w-16 rounded-full bg-primary/15" />
        </div>

        <RunnerAvatar runnerY={runnerY} status={status} />

        {obstacles.map((obstacle) => (
          <ObstacleShape key={obstacle.id} obstacle={obstacle} />
        ))}

        {status === 'idle' && (
          <>
            <div
              className="absolute right-[18%] bottom-4 h-6 w-[3.6%] rounded-sm border border-primary/20 bg-primary/10"
              aria-hidden
            />
            <div
              className="absolute right-[9%] bottom-4 h-8 w-[2.8%] rounded-sm border border-secondary-foreground/20 bg-secondary"
              aria-hidden
            />
          </>
        )}

        <span id={statusId} className="sr-only" aria-live="polite">
          {accessibleStatus}
          {prefersReducedMotion
            ? ' Reduced motion is enabled, and the game stays idle until interaction.'
            : ''}
        </span>
      </div>
    </section>
  );
}

export default FooterMiniGame;
