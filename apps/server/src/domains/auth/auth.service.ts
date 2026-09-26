import type { SignUpRequestDTO } from "@quill/shared";
import UserRepository from "../user/user.repository"
import type { UserModel } from "../user/user.model";
import { BadRequestError, ConflictError } from "../../core/errors";

class AuthService {
    private userRepo: UserRepository;

    constructor() {
        this.userRepo = new UserRepository();
    }

    async createAccount(data: SignUpRequestDTO): Promise<UserModel> {
        // Validate data
        if (!data.name || !data.email) {
            throw new BadRequestError("Name and email are required");
        }

        // check existing user
        const existingUser = await this.userRepo.findByEmail(data.email);
        if (existingUser) {
          throw new ConflictError("User already exists");
        }

        // Create user
        const newUser =await this.userRepo.createNewUser({
            name: data.name,
            email: data.email
        });

        return newUser;
    }

}

export default AuthService