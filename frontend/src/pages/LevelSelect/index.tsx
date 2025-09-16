import { useLocation, useNavigate } from "react-router-dom";
import type { TrajectoryItem } from "../../services/api";
import { getTrajectory, updateGoalLevels, updateByTopicGoalLevel } from "../../services/api";
import styles from "./index.module.css";
import { useMemo, useState } from "react";

const bullets = (text: string) => text.split("\n").filter(Boolean);

const LevelSelect = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const search = new URLSearchParams(location.search);
    const chatIdParam = search.get("chat_id");
    const state = location.state as { item?: TrajectoryItem; index?: number; chatId?: string; fromRelated?: boolean } | null;
    const item = state?.item;
    const fromRelated = Boolean(state?.fromRelated);

    const recommendedLevelRaw = Number(item?.skills?.recommended_level ?? 3);
    const recommendedIndex = Math.max(0, Math.min(2, Math.round(recommendedLevelRaw) - 2)); // 2->0, 3->1, 4->2
    const [selected, setSelected] = useState<number>(recommendedIndex);
    const [saving, setSaving] = useState<boolean>(false);

    const levels = useMemo(() => {
        // Собираем тексты из item.skills.levels по 2/3/4, если есть
        const present = (item?.skills.levels ?? []).filter((x) => x && (x.level === 2 || x.level === 3 || x.level === 4));
        const byLevel = new Map<number, { title: string; meta?: string; text: string[] }>();
        for (const l of present) {
            const title = l.level_name || (l.level === 2 ? "Базовый" : l.level === 3 ? "Уверенный" : "Продвинутый");
            const meta = l.meta || undefined;
            const text = bullets(l.description || "");
            byLevel.set(l.level, { title, meta, text });
        }
        const ensure = (lvl: number, fallback: string) => byLevel.get(lvl) || { title: fallback, meta: undefined, text: [] };
        return [ensure(2, "Базовый"), ensure(3, "Уверенный"), ensure(4, "Продвинутый")];
    }, [item]);

    const onSelect = async (idx: number) => {
        console.log("onSelect", idx);
        setSelected(idx);
        const chatId = chatIdParam ? Number(chatIdParam) : (state?.chatId ? Number(state.chatId) : undefined);
        if (!chatId || !item) return;
        try {
            setSaving(true);
            const chosenLevel = 2 + idx; // idx: 0->2,1->3,2->4
            const topicMain = item?.title || item?.skills?.name || "";
            if (fromRelated) {
                const topicParam = item?.skills?.name || "";
                try { await updateByTopicGoalLevel(chatId, topicParam, chosenLevel); } catch {}
                const nextItem: TrajectoryItem = { ...(item as TrajectoryItem), skills: { ...(item!.skills), goal_level: chosenLevel } } as TrajectoryItem;
                navigate(`/tasks?chat_id=${chatId}${topicParam ? `&topic=${encodeURIComponent(topicParam)}` : ""}` as string, {
                    state: { item: nextItem, chatId, fromRelated: true }
                });
                return;
            }
            const tr = await getTrajectory(chatId);
            // build new levels array for all items
            const current = (tr.items || []).map((it) => {
                const val = typeof it.skills.goal_level === "number" ? it.skills.goal_level : 0.1;
                return val < 1 ? 0.1 : Math.max(1, Math.min(4, Math.round(val)));
            });
            let findIndex = typeof state?.index === 'number' ? state.index : -1;
            if (findIndex < 0) {
                findIndex = (tr.items || []).findIndex((it) => it.title === item.title || it.skills?.name === item.skills?.name);
            }
            if (findIndex >= 0) {
                current[findIndex] = chosenLevel;
            }
            await updateGoalLevels(chatId, current);
            const nextItem: TrajectoryItem = { ...(item as TrajectoryItem), skills: { ...(item!.skills), goal_level: chosenLevel } } as TrajectoryItem;
            navigate(`/tasks?chat_id=${chatId}${topicMain ? `&topic=${encodeURIComponent(topicMain)}` : ""}` as string, {
                state: { item: nextItem, chatId }
            });
        } finally {
            setSaving(false);
        }
    };

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
                                        <div className={styles.card} onClick={() => onSelect(idx)}>
                                            <div className={styles.cardTitle}>{lv.title}</div>
                                            {lv.meta && <div className={styles.levelMeta}>{lv.meta}</div>}
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
                                <div key={idx} className={`${styles.card}`} onClick={() => onSelect(idx)}>
                                    <div className={styles.cardTitle}>{lv.title}</div>
                                    {lv.meta && <div className={styles.levelMeta}>{lv.meta}</div>}
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
                        <a
                          className={styles.ctaLink}
                          role="button"
                          onClick={() => { if (!saving) onSelect(recommendedIndex); }}
                        >
                           Продолжить с выбором ИИ
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LevelSelect;
