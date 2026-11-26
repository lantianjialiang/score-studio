import catalog from './examples-catalog.json';
import popular from './popular-examples.json';

export const exampleCategories = ['公版流行与拉格泰姆', '中国民歌', '世界民谣与童谣', '古典名曲'];
export const searchKey = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '')
  .toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

type Example = {
  slug: string;
  title: string;
  subtitle: string;
  alias: string;
  category: string;
  source: string;
  credit?: string;
  url?: string;
};

export const examples: Example[] = [
  { slug: 'twinkle-twinkle', title: '小星星', subtitle: '法国童谣', alias: 'Twinkle Twinkle Little Star',
    category: '世界民谣与童谣', source: '1=C 4/4 BPM=96\n1 1 5 5 | 6 6 5:h | 4 4 3 3 | 2 2 1:h | 5 5 4 4 | 3 3 2:h | 5 5 4 4 | 3 3 2:h | 1 1 5 5 | 6 6 5:h | 4 4 3 3 | 2 2 1:h' },
  { slug: 'ode-to-joy', title: '欢乐颂', subtitle: '贝多芬', alias: 'Ode to Joy',
    category: '古典名曲', source: '1=C 4/4 BPM=104\n3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 3:q. 2:8 2:h | 3 3 4 5 | 5 4 3 2 | 1 1 2 3 | 2:q. 1:8 1:h' },
  ...popular,
  ...catalog.map(example => example.alias.includes('Scott Joplin') ?
    { ...example, category: exampleCategories[0] } : example),
];
