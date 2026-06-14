export async function checkAuth(res, req, next){
    if(!req.user) {
        return res.status(401).json({message: "Unauthorized"})
    }

    res.status(200).json(req.user)
}