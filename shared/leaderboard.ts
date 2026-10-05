export type BoardKind='kills'|'deaths';
export type BoardRow={id:string;name:string;kills:number;deaths:number;rank:number|null};
export type BoardPage={kind:BoardKind;page:number;pageSize:number;total:number;rows:BoardRow[];me:BoardRow;time:number};
export type BoardReply={ok:true;board:BoardPage}|{ok:false;error:string};
export const BOARD_PAGE_SIZE=20;
