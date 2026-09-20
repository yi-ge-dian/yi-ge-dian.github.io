'use strict';

/**
 * post-assets: 让图片等资源直接放在文章同级目录
 *
 * 用法：把图片放进文章所在文件夹（与 index.md 同级或其子目录），
 * Hexo 生成时会自动发布到 /img/<文章相对路径>/ 下。
 *
 * 例：source/_posts/life/ospp-summer/featured.jpeg
 *  -> 可通过 /img/life/ospp-summer/featured.jpeg 访问
 *
 * 这样就不再需要在 source/img/ 下为每篇文章镜像建文件夹，
 * 且旧的 /img/... 引用链接无需修改。
 */

const path = require('path');
const fs = require('fs');

// 递归收集目录下的非 Markdown 资源文件（相对路径）
function listAssets(dir, baseDir) {
  const result = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return result;
  }
  for (const entry of entries) {
    // 跳过隐藏文件（.DS_Store、.git 等）
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...listAssets(fullPath, baseDir));
    } else if (!/\.(md|markdown)$/i.test(entry.name)) {
      result.push(path.relative(baseDir, fullPath));
    }
  }
  return result;
}

hexo.extend.generator.register('post-assets', function (locals) {
  const postsDir = path.join(this.source_dir, '_posts');
  const routes = [];

  for (const rel of listAssets(postsDir, postsDir)) {
    const filePath = path.join(postsDir, rel);
    const url = 'img/' + rel.split(path.sep).join('/');
    routes.push({
      path: url,
      data: function () {
        return fs.createReadStream(filePath);
      }
    });
  }

  return routes;
});

/**
 * 渲染前改写相对路径图片引用
 *
 * 兼容 Typora「复制图片到 ./${filename}.assets 文件夹」规则：
 * 文章里写的相对路径（如 index.assets/xxx.png、./xxx.png）
 * 会被自动改写为 /img/<文章相对路径>/... 绝对路径。
 *
 * 已是绝对路径（/...）或外链（http/https/data:）的不做处理。
 */
const RELATIVE_PREFIX = /^(\.\/)?(?!\.)/; // 允许 ./ 前缀或直接相对引用

function rewriteRelativeUrl(baseUrl, url) {
  if (!url) return url;
  if (/^(\/|#|https?:|data:|mailto:)/i.test(url)) return url; // 绝对路径或外链
  if (!RELATIVE_PREFIX.test(url)) return url;
  // 清理 ./ 前缀，拼接为站点绝对路径
  const clean = url.replace(/^\.\//, '');
  return baseUrl + '/' + clean;
}

hexo.extend.filter.register('before_post_render', function (data) {
  if (!data.full_source) return data;

  const postsDir = path.join(this.source_dir, '_posts');
  const rel = path.relative(postsDir, data.full_source);
  // _posts 之外的文件不处理
  if (rel.startsWith('..')) return data;

  // 文章所在目录（去掉 index.md 文件名本身），对应 /img/<目录>/
  const dirRel = path.dirname(rel).split(path.sep).join('/');
  const baseUrl = '/img' + (dirRel === '.' ? '' : '/' + dirRel);

  // 改写 front-matter 中的图片字段（cover/thumbnail/banner 等，
  // icarus 等主题直接用这些字段渲染 <img>，不经过 Markdown 渲染）
  const frontMatterImageFields = ['cover', 'thumbnail', 'banner'];
  for (const field of frontMatterImageFields) {
    if (typeof data[field] === 'string') {
      data[field] = rewriteRelativeUrl(baseUrl, data[field]);
    } else if (Array.isArray(data[field])) {
      data[field] = data[field].map(function (u) {
        return typeof u === 'string' ? rewriteRelativeUrl(baseUrl, u) : u;
      });
    }
  }

  // 改写 Markdown 图片 ![](path) 与链接 [text](path)
  // 注意：闭括号 ) 不纳入捕获组，否则会导致输出多一个右括号
  data.content = data.content.replace(
    /(!?\[([^\]]*)\]\()([^)\s]+)(\s+"[^"]*")?\)/g,
    function (match, prefix, text, url, title) {
      const newUrl = rewriteRelativeUrl(baseUrl, url);
      if (newUrl === url) return match;
      return prefix + newUrl + (title || '') + ')';
    }
  );

  // 改写 HTML <img src="path">（部分文章使用内嵌 HTML）
  data.content = data.content.replace(
    /(<img\s+[^>]*?src=)(["'])([^"']+)(\2)/gi,
    function (match, prefix, quote, url, quote2) {
      const newUrl = rewriteRelativeUrl(baseUrl, url);
      if (newUrl === url) return match;
      return prefix + quote + newUrl + quote2;
    }
  );

  return data;
});
