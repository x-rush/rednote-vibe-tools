const moduleSyntax = [
  /(?:^|[;\n}])\s*import\s+(?:["'{*]|[A-Za-z_$])/m,
  /(?:^|[;\n}])\s*export\b/m,
  /\bimport\s*\(/,
]

export function assertClassicScriptSource(source) {
  if (moduleSyntax.some((pattern) => pattern.test(source))) {
    throw new Error('小工具构建包含静态模块或动态模块语法')
  }
}
