import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import styles from "./index.module.css";
import RadarChart from "../../components/RadarChart";
import LoaderOverlay from "../../components/LoaderOverlay";
import { getTrajectory, type TrajectoryItem, type TrajectoryResponse } from "../../services/api";

const Trajectory = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const levels = [
    { title: "Базовый 👌", meta: "4 задания", text: "Основы генетики: ключевые понятия и типы изменчивости" },
    { title: "Уверенный 👍", meta: "6 заданий", text: "Практика: медицина, сельское хозяйство и др." },
    { title: "Продвинутый 🤘", meta: "7 заданий", text: "Мини-исследование по актуальной теме" },
  ];
  const [traj, setTraj] = useState<TrajectoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const didLoadSkillsRef = useRef(false);
  const [useAI, setUseAI] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const chatIdParam = urlParams.get("chat_id");
  const chatId = chatIdParam ? Number(chatIdParam) : undefined;

  // fetch trajectory data
  useEffect(() => {
    if (didLoadSkillsRef.current) return;
    didLoadSkillsRef.current = true;
    getTrajectory(chatId)
      .then((resp) => setTraj(resp))
      .catch(() => setTraj({ goal: "", items: [] }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const draw = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const width = container.scrollWidth;
      const height = container.scrollHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(216, 219, 240, 1)";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const containerRect = container.getBoundingClientRect();
      const count = traj?.items.length ?? 0;
      for (let i = 0; i < count - 1; i += 2) {
        const a = cardRefs.current[i];
        const b = cardRefs.current[i + 1];
        if (!a || !b) continue;
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const startX = aRect.right - containerRect.left + container.scrollLeft;
        const startY = aRect.top - containerRect.top + container.scrollTop + aRect.height / 1.35;
        const endX = bRect.left - containerRect.left + container.scrollLeft + bRect.width / 3;
        const endY = bRect.top - containerRect.top + container.scrollTop - 4;
        const midX = startX - (startX - endX); // horizontal offset
        const radius = 40;
        const hDir = endX > startX ? 1 : -1;
        const vDir = endY > startY ? 1 : -1;
        const beforeCornerX = midX - hDir * radius;
        const afterCornerY = startY + vDir * radius;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(beforeCornerX, startY);
        ctx.quadraticCurveTo(midX, startY, midX, afterCornerY);
        ctx.lineTo(midX, endY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      // second pattern: from right card (odd index) to next left card (odd->even)
      for (let i = 1; i < count - 1; i += 2) {
        const a = cardRefs.current[i];
        const b = cardRefs.current[i + 1];
        if (!a || !b) continue;
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        const startX = aRect.left - containerRect.left + container.scrollLeft; // left edge of right card
        const startY = aRect.top - containerRect.top + container.scrollTop + aRect.height / 1.4;
        const endX = bRect.left - containerRect.left + container.scrollLeft + bRect.width / 1.5;
        const endY = bRect.top - containerRect.top + container.scrollTop - 4;
        const horOffset = startX - endX;
        const midX = startX - horOffset; // current elbow X
        const radius = 40;
        const vDir = endY > startY ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        // horizontal segment to before the corner
        ctx.lineTo(midX + radius, startY);
        // rounded corner into vertical
        ctx.quadraticCurveTo(midX, startY, midX, startY + vDir * radius);
        // vertical to end level
        ctx.lineTo(midX, endY);
        // final horizontal to the target X
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    };

    const onResize = () => draw();
    const onScroll = () => draw();
    window.addEventListener("resize", onResize);
    containerRef.current?.addEventListener("scroll", onScroll, { passive: true } as AddEventListenerOptions);
    // draw after mount and after a tick (to wait images)
    draw();
    const id = window.setTimeout(draw, 50);
    return () => {
      window.removeEventListener("resize", onResize);
      containerRef.current?.removeEventListener("scroll", onScroll as any);
      window.clearTimeout(id);
    };
  }, [traj?.items.length]);

  if (loading) {
    return <LoaderOverlay text="Формирую траекторию по учебной цели…" />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.left}>
          <div className={styles.trContainer} ref={containerRef}>
            <div className={styles.topRow}>
              <button className={styles.backBtn} onClick={() => navigate(`/chat`, { state: { fromTrajectory: true, chatId: chatIdParam } })}>← Назад</button>
            </div>
            {traj?.goal && <div className={styles.header}>{traj.goal}</div>}
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />
            <div className={styles.cards}>
              {(traj?.items ?? []).map((t, idx) => {
                const alignLeft = idx % 2 === 0;
                const pairIndex = Math.floor(idx / 2) % 2; // 0 for pairs 1-2, 2 pairs pattern repeating
                const offset = pairIndex === 0 ? 50 : 70; // 1-2:80px, 3-4:96px, then repeat
                const style = alignLeft ? { marginLeft: `${offset}px` } : { marginRight: `${offset}px` };
                const faded = hoverIndex !== null && hoverIndex !== idx;
                return (
                  <div
                    key={`${t.title}-${idx}`}
                    className={`${styles.card} ${alignLeft ? styles.cardLeft : styles.cardRight} ${faded ? styles.faded : ""}`}
                    style={style}
                    ref={(el) => (cardRefs.current[idx] = el)}
                    onMouseEnter={() => setHoverIndex(idx)}
                    onMouseLeave={() => setHoverIndex((v) => (v === idx ? null : v))}
                  >
                    <div className={styles.cardImageContainer}>
                      <div className={styles.cardImageWrapper}>
                        <img className={styles.cardImage} src={t.image_url ?? ""} alt="" />
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTitle}>{t.title}</div>
                      <div className={styles.cardText}>{t.description ?? t.skills?.description ?? ""}</div>
                    </div>
                    {hoverIndex === idx && (
                      <div className={styles.overlay} style={{ left: 210 }}>
                        {levels.map((lv, i) => (
                          <div
                            key={i}
                            className={styles.levelCard}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.stopPropagation(); }}
                          >
                            <div className={styles.levelTitle}>{lv.title}</div>
                            <div className={styles.levelMeta}>{lv.meta}</div>
                            <div className={styles.levelText}>{lv.text}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className={styles.right}>
          {traj && (
            <div className={styles.chartArea}>
              <div className={styles.chartHeader}>
                <div className={styles.chartTitle}>Ты освоишь</div>
                <div className={styles.switchRow}>
                  <label className={styles.switch}>
                    <input
                      className={styles.switchInput}
                      type="checkbox"
                      checked={useAI}
                      onChange={(e) => setUseAI(e.target.checked)}
                    />
                    <span className={styles.switchBg}></span>
                    <span className={styles.switchKnob}></span>
                  </label>
                  <span className={styles.switchLabel}>ИИ-рекомендация</span>
                </div>
              </div>
              <RadarChart
                labels={traj.items.map((t) => t.skills.name)}
                series={[
                  {
                    name: "ИИ",
                    data: traj.items.map((t) => (useAI ? t.skills.recommended_level : 0)),
                    color: "rgb(188, 185, 185)",
                  },
                  {
                    name: "Мой уровень",
                    data: Array.from({ length: traj.items.length }, () => 1),
                    color: "#503AE0",
                    draggable: true,
                  },
                ]}
                pointsOnly={useAI}
                size={420}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Trajectory;


