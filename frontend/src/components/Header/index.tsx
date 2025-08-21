import styles from "./index.module.css";

const logo = new URL("../../icon/logo.svg", import.meta.url).href;
const profile = new URL("../../icon/profile.png", import.meta.url).href;

const Header = () => {
  return (
    <header className={styles.header}>
      <div className="container-fluid">
        <div className="row align-items-center justify-content-between">
          <div className="col-auto">
            <img src={logo} alt="Logo" className={styles.logo} />
          </div>
          <div className="col-auto">
            <img src={profile} alt="Profile" className={styles.profile} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;


