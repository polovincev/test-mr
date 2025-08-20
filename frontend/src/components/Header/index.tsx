import styles from "./index.module.css";

const logo = new URL("../../icon/logo.svg", import.meta.url).href;
const profile = new URL("../../icon/profile.png", import.meta.url).href;

const Header = () => {
  return (
    <header className={styles.header}>
      <div>
        <img src={logo} alt="Logo" className={styles.logo} />
      </div>
      <div>
        <img src={profile} alt="Profile" className={styles.profile} />
      </div>
    </header>
  );
};

export default Header;


