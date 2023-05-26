// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from 'next'

type Data = {
  name: string
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.status(200).json({ name: 'John Doe' })
}

export type Post = {
  [key: string]: any;
}

export type Posts = {
  [key: string]: Post;
}

export function generateRandomPosts(num: number): Posts {
  let posts: Posts = {};
  const date = new Date().toString();
  for (let i=1;i<=num;i++) {
    posts[i] = { id: i, title: `Post ${i}`, date };
  }
  return posts;
}
