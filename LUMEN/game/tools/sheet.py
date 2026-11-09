import sys,glob
from PIL import Image
d=sys.argv[1]; out=sys.argv[2]; cols=int(sys.argv[3]) if len(sys.argv)>3 else 6
fs=sorted(glob.glob(d+'/f*.png'))[:int(sys.argv[4]) if len(sys.argv)>4 else 18]
ims=[Image.open(f).resize((200,160)) for f in fs]
rows=(len(ims)+cols-1)//cols
S=Image.new('RGB',(cols*200,rows*160),'white')
for i,im in enumerate(ims): S.paste(im,((i%cols)*200,(i//cols)*160))
S.save(out); print(len(ims),out)
