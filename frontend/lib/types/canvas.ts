export type MirrorMode = "mirrored" | "asymmetric" | "disconnected" | "straight";

export interface VectorNode {
  id: string;
  x: number; 
  y: number;
  handleIn?: { x: number; y: number };  
  handleOut?: { x: number; y: number }; 
  mirror: MirrorMode;
}

export interface CanvasLayer {
  id: string;
  parentId?: string | null;
  
  type: "text" | "image" | "rect" | "ellipse" | "polygon" | "qr" | "frame" | "path";

  name?: string;

  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; 
  opacity: number;         
  zIndex: number;

  visible: boolean;
  locked: boolean;

  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "medium" | "semibold" | "bold";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right" | "justify";
  color?: string;          

  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;   
 
  pathData?: string;
  closed?: boolean;
  points?: string;
  
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  
  imageUrl?: string;
  qrValue?: string;

  nodes?: VectorNode[]; 

}
