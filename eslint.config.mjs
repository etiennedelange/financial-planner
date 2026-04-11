import { fixupConfigRules } from "@eslint/compat"
import coreWebVitals from "eslint-config-next/core-web-vitals"

const config = [
  { ignores: [".next/**", "coverage/**", "node_modules/**"] },
  ...fixupConfigRules(coreWebVitals),
]

export default config
