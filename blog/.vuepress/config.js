module.exports = {
    title: 'Nikita Balagansky', // Title for the site. This will be displayed in the navbar.
    theme: '@vuepress/theme-blog',
    plugins: ["vuepress-plugin-mathjax", 'vue-plotly'],
    themeConfig: {
        footer: {
            contact: [
              {
                type: 'github',
                link: 'https://github.com/elephantmipt',
              },
              {
                type: 'mail',
                link: 'balaganskij.nn@phystech.edu',
              },
            ],
            copyright: [
                {text: 'MIT Licensed | Copyright © 2021-present Nikita Balagansky'}
            ]
          },
          nav: [
            {
              text: 'Blog',
              link: '/',
            },
            {
              text: 'Tags',
              link: '/tag/',
            },
          ]
    }
}