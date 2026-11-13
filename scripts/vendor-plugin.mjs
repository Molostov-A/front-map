// Все внешние vendor-импорты бандла считаются от dist/, а не от исходного модуля.
import path from 'node:path';

export function vendorPlugin(root) {
  const vendor = path.join(root, 'vendor');
  return {
    name: 'vendor-relative-to-bundle',
    setup(build) {
      build.onResolve({ filter: /(?:^|\/)vendor\// }, (args) => {
        const relative = path.relative(vendor, path.resolve(args.resolveDir, args.path));
        if (relative.startsWith('..') || path.isAbsolute(relative)) return;
        return { path: './vendor/' + relative.split(path.sep).join('/'), external: true };
      });
    }
  };
}
