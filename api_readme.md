###  upload image

curl -X POST "https://ai.photocen.com/api/upload" \\

&nbsp; -F "image=@cat.jpg" \\

&nbsp; -F "title=Cat Image" \\

&nbsp; -F "tags=cat"



request:

curl -X POST "https://ai.photocen.com/api/upload" \\

&nbsp; -F "image=@cat\_img.jpg" \\

&nbsp; -F "title=Cat Image" \\

&nbsp; -F "tags=cat"

response:

{

&nbsp;   "image\_id": "img\_5027ca69db72578ea53e40168ab853be",

&nbsp;   "status": "uploaded",

&nbsp;   "original\_path": "\\/storage\\/original\\/img\_5027ca69db72578ea53e40168ab853be.jpg",

&nbsp;   "thumb\_path": "\\/storage\\/thumbs\\/img\_5027ca69db72578ea53e40168ab853be.webp",

&nbsp;   "title": "Cat Image",

&nbsp;   "tags": "cat"

}




### . ocr

curl -X POST http://your-domain/api/ocr \\

&nbsp; -F "image=@/path/to/image.jpg"



request:

curl -X POST https://ai.photocen.com/api/ocr   -F "image=@ocr\_example.png"



response:

{

&nbsp;   "job\_id": "job\_a76feade8299b9d5547d06b28674d4ea",

&nbsp;   "original\_text": "Store #05666\\n\\n3515 DEL MAR HTS,RD\\nSAN DIEGO, CA 92130\\n(858) 792-7040\\n\\nRegister #4 Transaction #571140\\nCashier #56661020 8/20/17 5:45PM\\n\\nwellness+ with Plenti\\nPlenti Card#: 31XXXXXXXXXX4553\\n1 G2 RETRACT BOLD BLK 2PK 1.99 T\\nSALE 1/1.99, Reg 1/4.69\\nDiscount 2.70-\\n\\n1 Items Subtotal 1.99\\nTax .15\\n\\n﹜ Total 2.14\\nxMASTERx 2.14\\n\\nMASTER card \* 400000005485\\nApp #AA APPROVAL AUTO\\n\\nRef # 05639E\\n\\nEntry Method: Chip",

&nbsp;   "corrected\_text": "Store #05666\\n\\n3515 Del Mar Hts Rd\\nSan Diego, CA 92130\\n(858) 792-7040\\n\\nRegister #4 Transaction #571140\\nCashier #56661020 8/20/17 5:45 PM\\n\\nwellness+ with Plenti\\nPlenti Card#: 31XXXXXXXXXX4553\\n1 G2 Retract Bold Blk 2PK 1.99 T\\nSALE $1.99, Reg $4.69\\nDiscount $2.70-\\n\\n1 Items Subtotal $1.99\\nTax $.15\\n\\n Total $2.14\\nxMASTERx $2.14\\n\\nMASTER card \* 400000005485\\nApp #AA APPROVAL AUTO\\n\\nRef #05639E\\n\\nEntry Method: Chip"



**note**: original text raw tesseract output, corrected text is result after ollama process (fixing typos).

It is implemented as a blocking request (i.e. you will wait until the server response for at most 2 minutes. If no response after 2 minutes, server will response time out error like this: {

&nbsp;   "error": "OCR job timed out. Please check status at https://ai.photocen.com/api/job/job\_4a630c91d44591a255774870a6a35531 for more details.",

&nbsp;   "check\_status\_url": "https://ai.photocen.com/api/job/job\_4a630c91d44591a255774870a6a35531"

}, output result can still be found from the url when the job finally finish)

