const { execSync } = require('child_process');
const fs = require('fs');

// Helper function to create directories if they don't exist
const createDirs = (dirs) => {
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Helper function to create files if they don't exist
const writeFiles = (files) => {
  files.forEach((file) => {
    fs.writeFileSync(file.path, file.content, { flag: 'w' });
  });
};

// Backend Setup
const setupBackend = () => {
  console.log('Setting up backend...');

  try {
    process.chdir('ride-share-backend');

    execSync(
      'npm install @nestjs/graphql @nestjs/apollo apollo-server-express graphql',
      { stdio: 'inherit' }
    );
    execSync(
      'npm install @nestjs/jwt @nestjs/passport passport passport-jwt',
      { stdio: 'inherit' }
    );
    execSync('npm install prisma @prisma/client', {
      stdio: 'inherit',
    });
    execSync('npm install @nestjs/mongoose mongoose', {
      stdio: 'inherit',
    });

    const backendFiles = [
      {
        path: 'prisma/schema.prisma',
        content: `
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  email     String   @unique
  password  String
  roles     String[]
}

model Ride {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  driverId  String
  riderId   String
  status    String
  createdAt DateTime @default(now())
}
`,
      },
      {
        path: 'src/app.module.ts',
        content: `
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { RideModule } from './ride/ride.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';
import { AuthService } from './auth/auth.service';
import { UserService } from './user/user.service';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      context: ({ req }) => ({ req, user: req.user }),
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '60m' },
    }),
    UserModule,
    AuthModule,
    PrismaModule,
    RideModule,
  ],
  providers: [
    AuthService,
    JwtStrategy,
    UserService,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
`,
      },
      {
        path: 'src/prisma/prisma.module.ts',
        content: `
import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
`,
      },
      {
        path: 'src/prisma/prisma.service.ts',
        content: `
import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
`,
      },
      {
        path: 'src/auth/jwt.strategy.ts',
        content: `
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.userService.findUserById(payload.sub);
    return user;
  }
}
`,
      },
      {
        path: 'src/auth/auth.module.ts',
        content: `
import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '60m' },
    }),
    UserModule,
  ],
  providers: [AuthService, AuthResolver, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
`,
      },
      {
        path: 'src/auth/auth.service.ts',
        content: `
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { AuthInput } from './dto/auth.input';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findUserByEmail(email);
    if (user && user.password === pass) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(authInput: AuthInput) {
    return this.userService.createUser(authInput);
  }
}
`,
      },
      {
        path: 'src/auth/auth.resolver.ts',
        content: `
import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import { AuthInput } from './dto/auth.input';
import { AuthResponse } from './dto/auth.response';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  @Mutation(() => AuthResponse)
  async login(@Args('authInput') authInput: AuthInput) {
    const user = await this.authService.validateUser(
      authInput.email,
      authInput.password,
    );
    if (!user) {
      throw new Error('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Mutation(() => AuthResponse)
  async register(@Args('authInput') authInput: AuthInput) {
    return this.authService.register(authInput);
  }
}
`,
      },
      {
        path: 'src/auth/dto/auth.input.ts',
        content: `
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class AuthInput {
  @Field()
  email: string;

  @Field()
  password: string;
}
`,
      },
      {
        path: 'src/auth/dto/auth.response.ts',
        content: `
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class AuthResponse {
  @Field()
  access_token: string;
}
`,
      },
      {
        path: 'src/user/user.module.ts',
        content: `
import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserResolver } from './user.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [UserService, UserResolver],
  exports: [UserService],
})
export class UserModule {}
`,
      },
      {
        path: 'src/user/user.service.ts',
        content: `
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthInput } from '../auth/dto/auth.input';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(authInput: AuthInput) {
    return this.prisma.user.create({
      data: {
        email: authInput.email,
        password: authInput.password,
      },
    });
  }
}
`,
      },
      {
        path: 'src/user/user.resolver.ts',
        content: `
import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UserService } from './user.service';
import { User } from './user.model';
import { CreateUserInput } from './dto/create-user.input';

@Resolver(() => User)
export class UserResolver {
  constructor(private userService: UserService) {}

  @Query(() => [User])
  async users() {
    return this.userService.findAll();
  }

  @Mutation(() => User)
  async createUser(@Args('createUserInput') createUserInput: CreateUserInput) {
    return this.userService.create(createUserInput);
  }
}
`,
      },
      {
        path: 'src/user/dto/create-user.input.ts',
        content: `
import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CreateUserInput {
  @Field()
  email: string;

  @Field()
  password: string;
}
`,
      },
      {
        path: 'src/user/user.model.ts',
        content: `
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field()
  password: string;

  @Field(() => [String])
  roles: string[];
}
`,
      },
      {
        path: 'src/ride/ride.module.ts',
        content: `
import { Module } from '@nestjs/common';
import { RideService } from './ride.service';
import { RideResolver } from './ride.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RideService, RideResolver],
})
export class RideModule {}
`,
      },
      {
        path: 'src/ride/ride.service.ts',
        content: `
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RideService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.ride.findMany();
  }
}
`,
      },
      {
        path: 'src/ride/ride.resolver.ts',
        content: `
import { Resolver, Query } from '@nestjs/graphql';
import { RideService } from './ride.service';
import { Ride } from './ride.model';

@Resolver(() => Ride)
export class RideResolver {
  constructor(private rideService: RideService) {}

  @Query(() => [Ride])
  async rides() {
    return this.rideService.findAll();
  }
}
`,
      },
      {
        path: 'src/ride/ride.model.ts',
        content: `
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class Ride {
  @Field()
  id: string;

  @Field()
  driverId: string;

  @Field()
  riderId: string;

  @Field()
  status: string;

  @Field()
  createdAt: Date;
}
`,
      },
    ];

    createDirs([
      'prisma',
      'src/prisma',
      'src/auth/dto',
      'src/user/dto',
      'src/ride',
    ]);
    writeFiles(backendFiles);

    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('Backend setup completed.');
  } catch (error) {
    console.error('Error setting up backend:', error);
  }
};

setupBackend();
