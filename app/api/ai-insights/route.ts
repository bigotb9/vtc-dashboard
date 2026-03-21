export async function POST(req:Request){

const {question}=await req.json()

return Response.json({

answer:`Analyse IA : ${question}`

})

}