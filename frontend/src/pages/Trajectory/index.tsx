import { useEffect, useRef } from "react";
import styles from "./index.module.css";
import RadarChart from "../../components/RadarChart";

const Trajectory = () => {
  const topics = [
    {
      id: 1,
      title: "Наследственность и изменчивость организмов",
      description:
        "Узнаешь основы генетики через механизмы передачи признаков от родителей к потомству",
      image:
        "https://images.unsplash.com/photo-1617635142686-6d8df2aefc58?q=80&w=1400&auto=format&fit=crop",
    },
    {
      id: 2,
      title: "Молекулярные основы жизни",
      description: "Разберёшь состав и свойства белков, углеводов, липидов, ДНК",
      image:
        "https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?q=80&w=1400&auto=format&fit=crop",
    },
    {
      id: 3,
      title: "Эволюционное учение",
      description: "Поймёшь механизмы эволюции и естественного отбора",
      image:
        "https://images.unsplash.com/photo-1590241581453-e67d862a4d99?q=80&w=1400&auto=format&fit=crop",
    },
    {
      id: 4,
      title: "Экосистемы и биосфера",
      description: "Разберёшься в структуре экосистем и глобальных циклах",
      image:
        "https://images.unsplash.com/photo-1465145782865-09532f760e0a?q=80&w=1400&auto=format&fit=crop",
    },
    {
      id: 5,
      title: "Человек и его здоровье",
      description: "Узнаешь про системы организма и основы здорового образа жизни",
      image:
        "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?q=80&w=1400&auto=format&fit=crop",
    },
    {
      id: 6,
      title: "Биотехнология",
      description: "Познакомишься с современными биотехнологическими методами",
      image:
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1400&auto=format&fit=crop",
    },
  ];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

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
      for (let i = 0; i < cardRefs.current.length - 1; i += 2) {
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
  }, [topics.length]);

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.left}>
          <div className={styles.trContainer} ref={containerRef}>
            <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }} />
            <div className={styles.cards}>
              {topics.map((t, idx) => {
                const alignLeft = idx % 2 === 0;
                const pairIndex = Math.floor(idx / 2) % 2; // 0 for pairs 1-2, 2 pairs pattern repeating
                const offset = pairIndex === 0 ? 40 : 60; // 1-2:80px, 3-4:96px, then repeat
                const style = alignLeft ? { marginLeft: `${offset}px` } : { marginRight: `${offset}px` };
                return (
                <div
                  key={t.id}
                  className={`${styles.card} ${alignLeft ? styles.cardLeft : styles.cardRight}`}
                  style={style}
                  ref={(el) => (cardRefs.current[idx] = el)}
                >
                  <img className={styles.cardImage} src={t.image} alt="" />
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{t.title}</div>
                    <div className={styles.cardText}>{t.description}</div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>
        <div className={styles.right}>
          <RadarChart
            labels={[
              "Наследственность и изменчивость организмов",
              "Молекулярные основы жизни",
              "Эволюционное учение",
              "Экосистемы и биосфера",
              "Человек и его здоровье",
              "Биотехнология",
              "Биотехнология",
            ]}
            series={[
              { name: "Целевой", data: [4, 5, 4, 5, 3, 4, 1], color: "#F062C0" },
              { name: "Достигнутый", data: [3, 4, 3, 2, 2, 3, 1], color: "#58E1DA" },
            ]}
            size={420}
          />
        </div>
      </div>
    </div>
  );
};

export default Trajectory;


