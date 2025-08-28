import { useLocation, useNavigate } from "react-router-dom";
import type { TrajectoryItem } from "../../services/api";
import styles from "./index.module.css";
import { useMemo, useState } from "react";

const bullets = (text: string) => text.split("\n").filter(Boolean);

const LevelSelect = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const search = new URLSearchParams(location.search);
    const chatIdParam = search.get("chat_id");
    const state = location.state as { item?: TrajectoryItem; chatId?: string } | null;
    const item = state?.item;

    const recommendedLevelRaw = Number(item?.skills?.recommended_level ?? 3);
    const recommendedIndex = Math.max(0, Math.min(2, Math.round(recommendedLevelRaw) - 2)); // 2->0, 3->1, 4->2

    const [selected, setSelected] = useState<number>(recommendedIndex); // default to AI recommendation

    const levels = useMemo(() => {
        // Собираем тексты из item.skills.levels по 2/3/4, если есть
        const present = (item?.skills.levels ?? []).filter((x) => x && (x.level === 2 || x.level === 3 || x.level === 4));
        const byLevel = new Map<number, { title: string; text: string[] }>();
        for (const l of present) {
            const title = l.level_name || (l.level === 2 ? "Базовый" : l.level === 3 ? "Уверенный" : "Продвинутый");
            const text = bullets(l.description || "");
            byLevel.set(l.level, { title, text });
        }
        const ensure = (lvl: number, fallback: string) => byLevel.get(lvl) || { title: fallback, text: [] };
        return [ensure(2, "Базовый"), ensure(3, "Уверенный"), ensure(4, "Продвинутый")];
    }, [item]);

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.backRow}>
                    <button className={styles.backBtn} onClick={() => navigate(`/trajectory${chatIdParam ? `?chat_id=${chatIdParam}` : ""}`)}>← К траектории</button>
                </div>
                <div className={styles.content}>
                    <div className={styles.header}>
                        <div className={styles.subtitle}>{item?.skills.name || ""}</div>
                        <div className={styles.title}>Выбери уровень обучения</div>
                    </div>
                    <div className={styles.grid}>
                        {levels.map((lv, idx) => {
                            if (idx === recommendedIndex) {
                                return (
                                    <div className={styles.cardSelected} key={idx}>
                                        <div className={styles.card} onClick={() => setSelected(idx)}>
                                            <div className={styles.cardTitle}>{lv.title}</div>
                                            <div className={styles.tasks}>{`${lv.text.length || (idx + 4)} заданий`}</div>
                                            <div className={styles.list}>
                                                {lv.text.slice(0, 4).map((t, i) => (
                                                    <div key={i}>• {t}</div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className={styles.recommend}>ИИ рекомендует</div>
                                    </div>
                                )
                            }
                            return (
                                <div key={idx} className={`${styles.card}`} onClick={() => setSelected(idx)}>
                                    <div className={styles.cardTitle}>{lv.title}</div>
                                    <div className={styles.tasks}>{`${lv.text.length || (idx + 4)} заданий`}</div>
                                    <div className={styles.list}>
                                        {lv.text.slice(0, 4).map((t, i) => (
                                            <div key={i}>• {t}</div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <div className={styles.ctaRow}>
                        <a className={styles.ctaLink} role="button" onClick={() => navigate(`/trajectory${chatIdParam ? `?chat_id=${chatIdParam}` : ""}`)}>Продолжить с выбором ИИ</a>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LevelSelect;
