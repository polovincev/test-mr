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
  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.left}>
          <div className={styles.trContainer}>
            <div className={styles.cards}>
              {topics.map((t, idx) => (
                <div key={t.id} className={`${styles.card} ${idx % 2 === 0 ? styles.cardLeft : styles.cardRight}`}>
                  <img className={styles.cardImage} src={t.image} alt="" />
                  <div className={styles.cardBody}>
                    <div className={styles.cardTitle}>{t.title}</div>
                    <div className={styles.cardText}>{t.description}</div>
                  </div>
                </div>
              ))}
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


