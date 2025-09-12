declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: string;
  export default src;
}

declare module "elkjs/lib/elk.bundled.js" {
  import ELK from "elkjs";
  export default ELK;
}


