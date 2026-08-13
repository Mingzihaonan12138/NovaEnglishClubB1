/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QuestionAnswer {
  id: string;
  topic: string;
  question: string;
  /** Empty when the teacher has not yet written this student's own answer. */
  suggestedAnswer: string;
  audioUrl: string;
  chineseMeaning?: string;
  /**
   * Which half of the exam this belongs to. Part 1 topics are chosen by the
   * student and are personal; Part 2 subject areas are fixed by Trinity and
   * shared, with only the answers being personal.
   */
  section?: 'Part 1' | 'Part 2';
}

export const TRINITY_B1_TOPICS = [
  "My daughter",
  "My cats",
  "My husband",
  "Family activities",
  "My house",
  "Music",
  "Recent Personal Experiences",
  "Special Occasions",
  "Festivals",
  "Entertainment",
  "Means of Transport"
];

export const B1_QUESTIONS: QuestionAnswer[] = [
  // My daughter
  {
    id: "d1",
    topic: "My daughter",
    question: "Do you have any children? / How many children do you have?",
    suggestedAnswer: "Yes, I do. I have one daughter, and she is sixteen years old.",
    audioUrl: "/audio/part1/d1.wav"
  },
  {
    id: "d2",
    topic: "My daughter",
    question: "Can you tell me more about your daughter?",
    suggestedAnswer: "Sure, she is sixteen years old. She studies at a school in Bolton and she is in Year 10. She is very kind and cute.",
    audioUrl: "/audio/part1/d2.wav"
  },
  {
    id: "d3",
    topic: "My daughter",
    question: "Where does she study?",
    suggestedAnswer: "She studies at a school in Bolton. She is in Year 10, and she likes school life quite a lot.",
    audioUrl: "/audio/part1/d3.wav"
  },
  {
    id: "d4",
    topic: "My daughter",
    question: "What are her hobbies?",
    suggestedAnswer: "Her hobbies are dressing up and shopping. She really enjoys going shopping, especially at weekends.",
    audioUrl: "/audio/part1/d4.wav"
  },
  {
    id: "d5",
    topic: "My daughter",
    question: "Does she enjoy shopping?",
    suggestedAnswer: "Yes, she does. She likes shopping very much because it helps her relax and makes her happy.",
    audioUrl: "/audio/part1/d5.wav"
  },
  {
    id: "d6",
    topic: "My daughter",
    question: "What does she like to buy when she goes shopping?",
    suggestedAnswer: "She likes to buy clothes and make-up. Sometimes she also looks at shoes and bags.",
    audioUrl: "/audio/part1/d6.wav"
  },
  {
    id: "d7",
    topic: "My daughter",
    question: "Do you often go shopping with her?",
    suggestedAnswer: "Sometimes I go shopping with her, but not very often. We usually go together at weekends when we both have time.",
    audioUrl: "/audio/part1/d7.wav"
  },
  {
    id: "d8",
    topic: "My daughter",
    question: "What is she like?",
    suggestedAnswer: "She is very kind and cute. She is also friendly, and I think she is easy to get along with.",
    audioUrl: "/audio/part1/d8.wav"
  },
  {
    id: "d9",
    topic: "My daughter",
    question: "What do you do together?",
    suggestedAnswer: "We often go shopping together. Sometimes we also talk, walk around the shopping centre.",
    audioUrl: "/audio/part1/d9.wav"
  },
  {
    id: "d10",
    topic: "My daughter",
    question: "What does she do every day?",
    suggestedAnswer: "She goes to school every day and studies hard. After school, she usually does her homework.",
    audioUrl: "/audio/part1/d10.wav"
  },
  {
    id: "d11",
    topic: "My daughter",
    question: "How does she spend her weekends?",
    suggestedAnswer: "At weekends, she usually relaxes and goes shopping. Sometimes she stays at home.",
    audioUrl: "/audio/part1/d11.wav"
  },
  {
    id: "d12",
    topic: "My daughter",
    question: "Does she help with housework at home?",
    suggestedAnswer: "Yes, sometimes she does. For example, she can clean her room and help with some simple housework.",
    audioUrl: "/audio/part1/d12.wav"
  },
  {
    id: "d13",
    topic: "My daughter",
    question: "Does she do any sports or activities?",
    suggestedAnswer: "Yes, sometimes she does. She likes walking around town and playing with her friends.",
    audioUrl: "/audio/part1/d13.wav"
  },
  {
    id: "d14",
    topic: "My daughter",
    question: "What do you hope for her future?",
    suggestedAnswer: "I hope she can be happy and healthy in the future. I also hope she can do well at school and have a good job one day.",
    audioUrl: "/audio/part1/d14.wav"
  },
  {
    id: "d15",
    topic: "My daughter",
    question: "What job would you like her to do in the future?",
    suggestedAnswer: "I hope she can find a job she really enjoys. For me, the most important thing is that she is happy and healthy.",
    audioUrl: "/audio/part1/d15.wav"
  },
  // My cats
  {
    id: "c1",
    topic: "My cats",
    question: "Can you tell me about your cats?",
    suggestedAnswer: "Yes, of course. I have two cats. One is called Oreal and the other is Louis. They are brothers and they are both two years old.",
    audioUrl: "/audio/part1/c1.wav"
  },
  {
    id: "c2",
    topic: "My cats",
    question: "What are your cats like?",
    suggestedAnswer: "They are very cute and lovely. Oreal is quiet and shy, but Louis is very active. I like them very much.",
    audioUrl: "/audio/part1/c2.wav"
  },
  {
    id: "c3",
    topic: "My cats",
    question: "What do they like doing?",
    suggestedAnswer: "They like playing with us at home. Oreal likes hide-and-seek, and Louis likes people to play with him. They are very playful every day.",
    audioUrl: "/audio/part1/c3.wav"
  },
  {
    id: "c4",
    topic: "My cats",
    question: "How do you play with your cats?",
    suggestedAnswer: "I play with them every day at home. Sometimes I play hide-and-seek with them. They look very happy.",
    audioUrl: "/audio/part1/c4.wav"
  },
  {
    id: "c5",
    topic: "My cats",
    question: "Do you like pets/cats?",
    suggestedAnswer: "Yes, I do. I like pets, especially my cats, because they are cute and they make me feel happy.",
    audioUrl: "/audio/part1/c5.wav"
  },
  {
    id: "c6",
    topic: "My cats",
    question: "What breed are your cats?",
    suggestedAnswer: "They are just ordinary domestic cats. They are not special breeds, but I think they are very lovely.",
    audioUrl: "/audio/part1/c6.wav"
  },
  {
    id: "c7",
    topic: "My cats",
    question: "What colour are your cats?",
    suggestedAnswer: "Oreal is black and white, and Louis is also black and white. I think their colours are very beautiful.",
    audioUrl: "/audio/part1/c7.wav"
  },
  {
    id: "c8",
    topic: "My cats",
    question: "What do your cats do every day?",
    suggestedAnswer: "They usually sleep, play, and walk around the house. Sometimes they play with each other.",
    audioUrl: "/audio/part1/c8.wav"
  },
  {
    id: "c9",
    topic: "My cats",
    question: "Are your cats friendly?",
    suggestedAnswer: "Yes, they are. Oreal is a little shy, but Louis is very active and friendly. They are both lovely cats.",
    audioUrl: "/audio/part1/c9.wav"
  },
  {
    id: "c10",
    topic: "My cats",
    question: "Do your cats make you happy?",
    suggestedAnswer: "Yes, they do. They make me feel relaxed and happy, especially when I am tired.",
    audioUrl: "/audio/part1/c10.wav"
  },
  {
    id: "c11",
    topic: "My cats",
    question: "Why do you like your cats?",
    suggestedAnswer: "I like them because they are cute, lovely, and fun to play with. They also give me company at home.",
    audioUrl: "/audio/part1/c11.wav"
  },
  // My husband
  {
    id: "h1",
    topic: "My husband",
    question: "Can you tell me about your husband?",
    suggestedAnswer: "My husband is an Uber driver. He works in Manchester and he is very hard-working.",
    audioUrl: "/audio/part1/h1.wav"
  },
  {
    id: "h2",
    topic: "My husband",
    question: "What does your husband do?",
    suggestedAnswer: "He is an Uber driver. He drives people around Manchester every day.",
    audioUrl: "/audio/part1/h2.wav"
  },
  {
    id: "h3",
    topic: "My husband",
    question: "Where does he work?",
    suggestedAnswer: "He works in Manchester. He knows the city quite well because he drives there every day.",
    audioUrl: "/audio/part1/h3.wav"
  },
  {
    id: "h4",
    topic: "My husband",
    question: "What time does he start work?",
    suggestedAnswer: "He usually starts work at 7 o’clock in the morning. He gets up early for work.",
    audioUrl: "/audio/part1/h4.wav"
  },
  {
    id: "h5",
    topic: "My husband",
    question: "What time does he finish work?",
    suggestedAnswer: "He usually finishes work at 7 o’clock in the evening. He often has a long working day.",
    audioUrl: "/audio/part1/h5.wav"
  },
  {
    id: "h6",
    topic: "My husband",
    question: "What does he do at work?",
    suggestedAnswer: "He drives people around Manchester. He takes passengers to different places in the city.",
    audioUrl: "/audio/part1/h6.wav"
  },
  {
    id: "h7",
    topic: "My husband",
    question: "Does he like his job?",
    suggestedAnswer: "Yes, he does. He likes his job very much because he meets different people every day.",
    audioUrl: "/audio/part1/h7.wav"
  },
  {
    id: "h8",
    topic: "My husband",
    question: "How many hours does he work a day?",
    suggestedAnswer: "He works about 10 hours a day. That is quite a long time.",
    audioUrl: "/audio/part1/h8.wav"
  },
  {
    id: "h9",
    topic: "My husband",
    question: "Is his job tiring?",
    suggestedAnswer: "Yes, sometimes it is tiring. But he enjoys it and still likes his job.",
    audioUrl: "/audio/part1/h9.wav"
  },
  {
    id: "h10",
    topic: "My husband",
    question: "What is your husband like?",
    suggestedAnswer: "He is very hard-working and kind. He is also caring and responsible.",
    audioUrl: "/audio/part1/h10.wav"
  },
  // Family activities
  {
    id: "f1",
    topic: "Family activities",
    question: "What activities do you do with your family?",
    suggestedAnswer: "We usually go shopping, eat out, and watch movies together. These are our favourite family activities.",
    audioUrl: "/audio/part1/f1.wav"
  },
  {
    id: "f2",
    topic: "Family activities",
    question: "How often do you spend time together?",
    suggestedAnswer: "We spend time together quite often. Family time is important to us.",
    audioUrl: "/audio/part1/f2.wav"
  },
  {
    id: "f3",
    topic: "Family activities",
    question: "When do you usually spend time with your family?",
    suggestedAnswer: "I usually spend time with my family every day, especially in the evening.",
    audioUrl: "/audio/part1/f3.wav"
  },
  {
    id: "f4",
    topic: "Family activities",
    question: "Do you enjoy spending time with your family? Why?",
    suggestedAnswer: "Yes, I do. I really enjoy it because everyone feels relaxed and happy when we are together.",
    audioUrl: "/audio/part1/f4.wav"
  },
  {
    id: "f5",
    topic: "Family activities",
    question: "Do you think it’s important to have family activities?",
    suggestedAnswer: "Yes, I do. I think family activities are important because they help us relax and stay close to each other.",
    audioUrl: "/audio/part1/f5.wav"
  },
  {
    id: "f6",
    topic: "Family activities",
    question: "What do you do during long holidays?",
    suggestedAnswer: "During long holidays, like Christmas or summer holidays, we travel to other countries. It is a good time for the whole family to relax.",
    audioUrl: "/audio/part1/f6.wav"
  },
  {
    id: "f7",
    topic: "Family activities",
    question: "Which countries have you visited?",
    suggestedAnswer: "We have visited Thailand and Japan many times. They are both very nice places for family trips.",
    audioUrl: "/audio/part1/f7.wav"
  },
  {
    id: "f8",
    topic: "Family activities",
    question: "What family activity would you like to try in the future?",
    suggestedAnswer: "In the future, I would like to travel to more countries with my family. I think it would be exciting and meaningful.",
    audioUrl: "/audio/part1/f8.wav"
  },
  {
    id: "f9",
    topic: "Family activities",
    question: "Who do you usually spend the most time with in your family?",
    suggestedAnswer: "I usually spend the most time with my husband and my daughter. We often relax together.",
    audioUrl: "/audio/part1/f9.wav"
  },
  {
    id: "f10",
    topic: "Family activities",
    question: "What is your favourite family activity?",
    suggestedAnswer: "My favourite family activity is travelling. I enjoy it because we can relax and see new places together.",
    audioUrl: "/audio/part1/f10.wav"
  },
  // My house
  {
    id: "ho1",
    topic: "My house",
    question: "Do you live in a house or a flat?",
    suggestedAnswer: "I live in a house. It is a detached house.",
    audioUrl: "/audio/part1/ho1.wav"
  },
  {
    id: "ho2",
    topic: "My house",
    question: "Where is your house?",
    suggestedAnswer: "My house is in a nice area. It is in a convenient place for my daily life.",
    audioUrl: "/audio/part1/ho2.wav"
  },
  {
    id: "ho3",
    topic: "My house",
    question: "What is your home like?",
    suggestedAnswer: "My home is big and comfortable. It is a detached house with a lovely garden.",
    audioUrl: "/audio/part1/ho3.wav"
  },
  {
    id: "ho4",
    topic: "My house",
    question: "How many rooms are there in your home?",
    suggestedAnswer: "There are four bedrooms, three bathrooms, a kitchen, and a living room. It is quite a big house.",
    audioUrl: "/audio/part1/ho4.wav"
  },
  {
    id: "ho5",
    topic: "My house",
    question: "Which room do you like best?",
    suggestedAnswer: "I like the living room best. It is comfortable and it is a good place to relax.",
    audioUrl: "/audio/part1/ho5.wav"
  },
  {
    id: "ho6",
    topic: "My house",
    question: "Is your home good for family life?",
    suggestedAnswer: "Yes, it is. It is big and comfortable, so it is very good for family life.",
    audioUrl: "/audio/part1/ho6.wav"
  },
  {
    id: "ho7",
    topic: "My house",
    question: "Which part of your home do you like best?",
    suggestedAnswer: "I like the garden best. I enjoy having barbecues there with my friends and family.",
    audioUrl: "/audio/part1/ho7.wav"
  },
  {
    id: "ho8",
    topic: "My house",
    question: "Who do you live with?",
    suggestedAnswer: "I live with my family. We enjoy spending time together at home.",
    audioUrl: "/audio/part1/ho8.wav"
  },
  {
    id: "ho9",
    topic: "My house",
    question: "What do you usually do at home?",
    suggestedAnswer: "I usually relax at home with my family. Sometimes we also spend time in the garden together.",
    audioUrl: "/audio/part1/ho9.wav"
  },
  {
    id: "ho10",
    topic: "My house",
    question: "Do you like your home? / What do you like about your home?",
    suggestedAnswer: "Yes, I do. I love my home very much because it is big and has a lovely garden.",
    audioUrl: "/audio/part1/ho10.wav"
  },
  {
    id: "ho11",
    topic: "My house",
    question: "Would you like to change your home in the future?",
    suggestedAnswer: "No, not really. I like my home very much and I feel comfortable living there.",
    audioUrl: "/audio/part1/ho11.wav"
  },
  {
    id: "ho12",
    topic: "My house",
    question: "Why is your garden special to you?",
    suggestedAnswer: "My garden is special to me because I enjoy spending time there. I like having barbecues with my friends and family.",
    audioUrl: "/audio/part1/ho12.wav"
  },
  // Music
  {
    id: "m1",
    topic: "Music",
    question: "What kind of music do you like to listen to? Why? (What type of music do you listen to most? / What music do you like most? / Why do you like that kind of music?)",
    suggestedAnswer: "I listen to Cantonese music. Because I like the melody. It makes me feel happy and relaxed.",
    audioUrl: "/audio/part1/m1.wav"
  },
  {
    id: "m2",
    topic: "Music",
    question: "Who is your favourite singer or band? What do you like about them? (Do you have a favourite singer or group? / Who do you enjoy listening to? Why? / What do you like about them?)",
    suggestedAnswer: "My favourite singer is Sammi. I like her songs because the melody is beautiful. I enjoy her music.",
    audioUrl: "/audio/part1/m2.wav"
  },
  {
    id: "m3",
    topic: "Music",
    question: "Do you prefer listening to music alone or with friends? Why? (Who do you usually listen to music with? / Do you like listening to music by yourself or with others?)",
    suggestedAnswer: "I like listening to music alone. Because it is quiet. It helps me enjoy the music in my free time.",
    audioUrl: "/audio/part1/m3.wav"
  },
  {
    id: "m4",
    topic: "Music",
    question: "How often do you listen to music? (How much time do you spend listening to music? / When do you usually listen to music?)",
    suggestedAnswer: "I listen to music every day. Especially when I drive. It makes me feel relaxed and happy.",
    audioUrl: "/audio/part1/m4.wav"
  },
  {
    id: "m5",
    topic: "Music",
    question: "Can you describe a song that has a special meaning to you? (Tell me about a song you really like. / What song means a lot to you? / What is your favourite song?)",
    suggestedAnswer: "I like the song Zhong Shen Mei Li. It is a Cantonese song. I like the song because the melody is beautiful. I like it very much.",
    audioUrl: "/audio/part1/m5.wav"
  },
  {
    id: "m6",
    topic: "Music",
    question: "Do you play any musical instruments? (Would you like to learn how to play a new instrument? Why or why not? / Do you want to learn a new instrument?)",
    suggestedAnswer: "No, I don’t. It is very hard for me. I prefer listening to music. I don’t have time to learn it.",
    audioUrl: "/audio/part1/m6.wav"
  },
  {
    id: "m7",
    topic: "Music",
    question: "How important is music in your daily life?",
    suggestedAnswer: "It is very important for me. I like listening to music when I drive. It makes me feel happy.",
    audioUrl: "/audio/part1/m7.wav"
  },
  {
    id: "m8",
    topic: "Music",
    question: "Do you like going to concerts or music festivals? Why or why not?",
    suggestedAnswer: "I like going to a concert. Because it has many Cantonese songs. I like Cantonese music very much. It makes me feel happy and relaxed.",
    audioUrl: "/audio/part1/m8.wav"
  },
  {
    id: "m9",
    topic: "Music",
    question: "What kind of music is popular in your country? (What music do people like in your country? / What music is popular where you live?)",
    suggestedAnswer: "I think Cantonese music is popular. Many people enjoy Cantonese music because the melody is beautiful. It makes people forget stress.",
    audioUrl: "/audio/part1/m9.wav"
  },
  {
    id: "m10",
    topic: "Music",
    question: "Would you like to learn a new instrument? Why or why not? (Do you want to learn a new instrument? / Would you like to learn how to play a new instrument?)",
    suggestedAnswer: "No, I don’t. It is very hard for me. I prefer listening to music. I don’t have time to learn it.",
    audioUrl: "/audio/part1/m10.wav"
  },
  // Recent Personal Experiences
  {
    id: "t1",
    topic: "Recent Personal Experiences",
    question: "Can you describe a recent trip you went on? (Tell me about a recent trip. / Where did you go recently? / Can you talk about a trip you had recently?)",
    suggestedAnswer: "I went to Japan with my family last year. We visited some interesting places and had some delicious food. We had a good time.",
    audioUrl: "/audio/part1/t1.wav"
  },
  {
    id: "t2",
    topic: "Recent Personal Experiences",
    question: "Have you tried something new recently? (Did you learn something new recently? / Have you done something new recently?)",
    suggestedAnswer: "Yes, I learned English recently. It was very hard for me. But now I can speak a little.",
    audioUrl: "/audio/part1/t2.wav"
  },
  {
    id: "t3",
    topic: "Recent Personal Experiences",
    question: "Tell me about a recent event that made you feel happy. (Do you have a recent event that made you feel excited? / Can you describe a recent experience that made you happy?)",
    suggestedAnswer: "Recently, I learned English. It was very hard, but I enjoyed it. It was a great experience.",
    audioUrl: "/audio/part1/t3.wav"
  },
  {
    id: "t4",
    topic: "Recent Personal Experiences",
    question: "Have you met someone interesting recently?",
    suggestedAnswer: "I met an interesting person when I was shopping. We talked a lot. She was from Hong Kong. It made me feel happy.",
    audioUrl: "/audio/part1/t4.wav"
  },
  {
    id: "t5",
    topic: "Recent Personal Experiences",
    question: "What was the last movie or TV show you watched? (What movie did you watch recently? / What TV show did you watch recently?)",
    suggestedAnswer: "I watched the movie Shaolin Soccer. It is a funny Hong Kong film about football. I like it because it makes me laugh.",
    audioUrl: "/audio/part1/t5.wav"
  },
  {
    id: "t6",
    topic: "Recent Personal Experiences",
    question: "Did you try any new food or drink recently?",
    suggestedAnswer: "I tried Japanese noodles recently. They were very tasty. I liked them very much.",
    audioUrl: "/audio/part1/t6.wav"
  },
  {
    id: "t7",
    topic: "Recent Personal Experiences",
    question: "Have you done any physical activity or sport recently? (Have you exercised recently? / Have you done any sport recently?)",
    suggestedAnswer: "Recently, I had a walk in the park. I go for a walk three times a week. It makes me feel healthy and relaxed.",
    audioUrl: "/audio/part1/t7.wav"
  },
  {
    id: "t8",
    topic: "Recent Personal Experiences",
    question: "What is the most recent book you read?",
    suggestedAnswer: "I didn’t read any books recently. I didn’t have much time because I am learning English now.",
    audioUrl: "/audio/part1/t8.wav"
  },
  {
    id: "t9",
    topic: "Recent Personal Experiences",
    question: "Have you had any challenges recently? (Did you have any difficult experience recently? / What difficult thing did you do recently?)",
    suggestedAnswer: "I learned English recently. It is very hard for me. But I enjoy it. It is a great experience. Speaking English is hard for me. I can’t remember new words.",
    audioUrl: "/audio/part1/t9.wav"
  },
  // Special Occasions
  {
    id: "s1",
    topic: "Special Occasions",
    question: "What is a special occasion that you celebrate with your family? (Is there a special day you celebrate with your family? / What family celebrations do you usually have? / What special occasions are important in your family?)",
    suggestedAnswer: "I celebrate my birthday with my family. We usually have a birthday cake. My daughter always gives me a birthday gift, like flowers. It makes me feel happy.",
    audioUrl: "/audio/part1/s1.wav"
  },
  {
    id: "s2",
    topic: "Special Occasions",
    question: "Can you describe a birthday party you really enjoyed? (What was the best birthday party you’ve been to? / Can you talk about a memorable birthday celebration? / Have you ever had a birthday party you really liked?)",
    suggestedAnswer: "I attended my daughter’s birthday party last year. We ate the birthday cake together. We also took photos. We had a good time.",
    audioUrl: "/audio/part1/s2.wav"
  },
  {
    id: "s3",
    topic: "Special Occasions",
    question: "Do you prefer small gatherings or big celebrations? Why? (Do you prefer small parties or big celebrations? / Do you prefer small parties or big parties? Why?)",
    suggestedAnswer: "I prefer small gatherings. Because it is easy to talk. It is not crowded. I feel very comfortable and relaxed.",
    audioUrl: "/audio/part1/s3.wav"
  },
  {
    id: "s4",
    topic: "Special Occasions",
    question: "What is the most memorable special occasion you’ve ever had? (What’s the most exciting celebration you’ve ever been to? / What special occasion do you remember the most? / Can you talk about an important event in your life? / Can you describe an exciting party or event?)",
    suggestedAnswer: "I attended my friend’s Christmas party last year. We had a big dinner. We also took photos together. We had a good time.",
    audioUrl: "/audio/part1/s4.wav"
  },
  {
    id: "s5",
    topic: "Special Occasions",
    question: "How do you prepare for a special occasion?",
    suggestedAnswer: "I usually stay with my family. We prepare the food and cook together. It puts me in a good mood.",
    audioUrl: "/audio/part1/s5.wav"
  },
  {
    id: "s6",
    topic: "Special Occasions",
    question: "Can you describe a time when you received a gift that made you very happy? (Tell me about a gift you really liked. / Can you talk about a meaningful present? / What is the best gift you’ve ever received?)",
    suggestedAnswer: "I got a pair of shoes from my daughter on my birthday last year. They look very beautiful and comfortable. I liked them very much.",
    audioUrl: "/audio/part1/s6.wav"
  },
  {
    id: "s7",
    topic: "Special Occasions",
    question: "What’s the most memorable holiday you’ve had? Why do you remember it so well? (Have you had a holiday that was very special to you? / Can you describe a holiday you will never forget? / What is the best holiday you’ve ever had? Why was that holiday so memorable?)",
    suggestedAnswer: "I went to Japan with my family six years ago. We visited many interesting places and had some delicious food. We had a good time.",
    audioUrl: "/audio/part1/s7.wav"
  },
  {
    id: "s8",
    topic: "Special Occasions",
    question: "Which interesting places have you visited?",
    suggestedAnswer: "We went to some big shopping centres. They are very modern. We spent much time there.",
    audioUrl: "/audio/part1/s8.wav"
  },
  {
    id: "s9",
    topic: "Special Occasions",
    question: "Did you try any food?",
    suggestedAnswer: "Yes, I did. I had some Japanese noodles. I liked them very much.",
    audioUrl: "/audio/part1/s9.wav"
  },
  // Festivals
  {
    id: "fe1",
    topic: "Festivals",
    question: "What is your favourite festival? Why?",
    suggestedAnswer: "My favourite festival is Chinese New Year. We clean the house and have a big dinner. It makes me feel happy.",
    audioUrl: "/audio/part1/fe1.wav"
  },
  {
    id: "fe2",
    topic: "Festivals",
    question: "How do people usually celebrate it in your country?",
    suggestedAnswer: "People usually decorate the house and have a big dinner. People also eat dumplings. It makes people feel warm and happy.",
    audioUrl: "/audio/part1/fe2.wav"
  },
  {
    id: "fe3",
    topic: "Festivals",
    question: "What traditional food do you eat during the festival?",
    suggestedAnswer: "We eat dumplings and fish. They mean good luck and happiness. They are very tasty. I like them very much.",
    audioUrl: "/audio/part1/fe3.wav"
  },
  {
    id: "fe4",
    topic: "Festivals",
    question: "Do you give or receive presents at festivals?",
    suggestedAnswer: "Yes. We often give sweets and fruit. I also receive flowers from my husband. It means good luck and happiness.",
    audioUrl: "/audio/part1/fe4.wav"
  },
  {
    id: "fe5",
    topic: "Festivals",
    question: "Do you celebrate festivals with your family or friends?",
    suggestedAnswer: "I usually celebrate festivals with my family. We decorate the house and have a dinner. We have a good time.",
    audioUrl: "/audio/part1/fe5.wav"
  },
  {
    id: "fe6",
    topic: "Festivals",
    question: "Can you describe a special festival you have attended?",
    suggestedAnswer: "I attended a Mid-Autumn Festival party last year. We had mooncakes and watched the moon. We had a good time.",
    audioUrl: "/audio/part1/fe6.wav"
  },
  {
    id: "fe7",
    topic: "Festivals",
    question: "Do you prefer traditional festivals or modern celebrations? Why?",
    suggestedAnswer: "I prefer traditional festivals because I can stay with my family. It is meaningful to me.",
    audioUrl: "/audio/part1/fe7.wav"
  },
  {
    id: "fe8",
    topic: "Festivals",
    question: "What common foods do people eat during festivals in your country?",
    suggestedAnswer: "People eat dumplings and fish. They mean good luck and happiness. They are really tasty. I like them very much.",
    audioUrl: "/audio/part1/fe8.wav"
  },
  {
    id: "fe9",
    topic: "Festivals",
    question: "How do you prepare for the festival?",
    suggestedAnswer: "We clean the house, buy new clothes, and put up decorations. We also make traditional food and prepare the big family dinner. It brings us together.",
    audioUrl: "/audio/part1/fe9.wav"
  },
  {
    id: "fe10",
    topic: "Festivals",
    question: "Have you celebrated a British festival?",
    suggestedAnswer: "Yes, I celebrated Christmas last year. We bought a Christmas tree and had a big dinner. We had a good time.",
    audioUrl: "/audio/part1/fe10.wav"
  },
  {
    id: "fe11",
    topic: "Festivals",
    question: "Do you like Christmas? Why?",
    suggestedAnswer: "Yes, I like it because I can relax and spend time with my family. The food is really tasty. It makes me feel happy.",
    audioUrl: "/audio/part1/fe11.wav"
  },
  // Entertainment
  {
    id: "e1",
    topic: "Entertainment",
    question: "What do you usually do for entertainment in your free time? (How do you usually spend your free time? / What do you do for fun?)",
    suggestedAnswer: "In my free time, I like going shopping with my daughter. Because I can buy things, like clothes and food. It makes me feel relaxed.",
    audioUrl: "/audio/part1/e1.wav"
  },
  {
    id: "e2",
    topic: "Entertainment",
    question: "Do you prefer watching movies at home or in the cinema? Why?",
    suggestedAnswer: "I usually prefer watching movies at home. Because I like spending time with my family together. It helps me forget stress.",
    audioUrl: "/audio/part1/e2.wav"
  },
  {
    id: "e3",
    topic: "Entertainment",
    question: "Can you describe a TV program or movie that you really enjoyed? (Which movie do you like?)",
    suggestedAnswer: "I like the movie Shaolin Soccer. It is a funny Hong Kong film about football. I like it because it makes me laugh.",
    audioUrl: "/audio/part1/e3.wav"
  },
  {
    id: "e4",
    topic: "Entertainment",
    question: "What kind / type of movies do you like?",
    suggestedAnswer: "I like Hong Kong movies. Because they are interesting. They make me feel relaxed.",
    audioUrl: "/audio/part1/e4.wav"
  },
  {
    id: "e5",
    topic: "Entertainment",
    question: "Have you ever been to the cinema in England / the UK?",
    suggestedAnswer: "Yes, I have. Sometimes Hong Kong movies are shown in the UK. I like Hong Kong movies because they are interesting.",
    audioUrl: "/audio/part1/e5.wav"
  },
  {
    id: "e6",
    topic: "Entertainment",
    question: "Have you ever been to the cinema in Hong Kong?",
    suggestedAnswer: "Yes, I have. It is convenient to watch movies in Hong Kong. I like watching movies there.",
    audioUrl: "/audio/part1/e6.wav"
  },
  {
    id: "e7",
    topic: "Entertainment",
    question: "What kind of music do you like to listen to for entertainment? (What music do you enjoy?)",
    suggestedAnswer: "I listen to Cantonese music. Because I like the melody. It makes me feel happy and relaxed.",
    audioUrl: "/audio/part1/e7.wav"
  },
  {
    id: "e8",
    topic: "Entertainment",
    question: "Do you enjoy playing video games? Why or why not?",
    suggestedAnswer: "No, I don’t. Because I don’t have much time. I prefer listening to music.",
    audioUrl: "/audio/part1/e8.wav"
  },
  {
    id: "e9",
    topic: "Entertainment",
    question: "Have you ever been to a live concert or performance?",
    suggestedAnswer: "Yes, I have. I have been to many concerts in Hong Kong. I like Cantonese music because it helps me forget stress.",
    audioUrl: "/audio/part1/e9.wav"
  },
  {
    id: "e10",
    topic: "Entertainment",
    question: "What is your favourite form of entertainment when you’re travelling? (What do you like doing when you are travelling?)",
    suggestedAnswer: "I like listening to Cantonese music when I am travelling. The melody is beautiful. It makes me feel relaxed and happy.",
    audioUrl: "/audio/part1/e10.wav"
  },
  {
    id: "e11",
    topic: "Entertainment",
    question: "Do you prefer outdoor activities or indoor entertainment? Why?",
    suggestedAnswer: "I usually prefer indoor activities, like watching movies at home. Because I like spending time with my family. It makes me feel comfortable.",
    audioUrl: "/audio/part1/e11.wav"
  },
  // Means of Transport
  {
    id: "tr1",
    topic: "Means of Transport",
    question: "How did you get here today?",
    suggestedAnswer: "I drove here. It took me 40 minutes to get here. It was convenient and fast.",
    audioUrl: "/audio/part1/tr1.wav"
  },
  {
    id: "tr2",
    topic: "Means of Transport",
    question: "What’s your favourite means of transport? Why?",
    suggestedAnswer: "I like travelling by car. Because it is cheap and convenient. It can save my time.",
    audioUrl: "/audio/part1/tr2.wav"
  },
  {
    id: "tr3",
    topic: "Means of Transport",
    question: "How do you usually travel / go to work?",
    suggestedAnswer: "I am a housewife. So I usually stay at home. Sometimes I go out by car.",
    audioUrl: "/audio/part1/tr3.wav"
  },
  {
    id: "tr4",
    topic: "Means of Transport",
    question: "How do you usually go shopping?",
    suggestedAnswer: "I usually go shopping by car. Because I can carry many things. It is convenient and fast.",
    audioUrl: "/audio/part1/tr4.wav"
  },
  {
    id: "tr5",
    topic: "Means of Transport",
    question: "What are the advantages and disadvantages of public transport?",
    suggestedAnswer: "Public transport has some advantages and disadvantages. The advantages are that it is fast and easy to use. But the disadvantages are that it can be crowded and sometimes late.",
    audioUrl: "/audio/part1/tr5.wav"
  },
  {
    id: "tr6",
    topic: "Means of Transport",
    question: "Do you prefer travelling by car, train or plane? Why?",
    suggestedAnswer: "I usually travel by car in Hong Kong. And I like travelling by plane if I go to another country. It is fast and comfortable.",
    audioUrl: "/audio/part1/tr6.wav"
  },
  {
    id: "tr7",
    topic: "Means of Transport",
    question: "How do you usually travel when you go on holiday / to another country?",
    suggestedAnswer: "I usually travel by car in Hong Kong. And I like travelling by plane if I go to another country. It is fast and comfortable.",
    audioUrl: "/audio/part1/tr7.wav"
  },
  {
    id: "tr8",
    topic: "Means of Transport",
    question: "Is transport in your city expensive?",
    suggestedAnswer: "Yes, it is expensive. So I usually drive. It is convenient and cheap for me.",
    audioUrl: "/audio/part1/tr8.wav"
  },
  {
    id: "tr9",
    topic: "Means of Transport",
    question: "What is the best way to travel around your hometown?",
    suggestedAnswer: "My hometown is Hong Kong. The best way to travel is by car. Because it is convenient and I can enjoy the view.",
    audioUrl: "/audio/part1/tr9.wav"
  },
  {
    id: "tr10",
    topic: "Means of Transport",
    question: "Do you prefer public transport or driving a car?",
    suggestedAnswer: "I prefer driving a car. Because it is cheap and convenient. I can carry many things.",
    audioUrl: "/audio/part1/tr10.wav"
  },
  {
    id: "tr11",
    topic: "Means of Transport",
    question: "What is the most interesting transport you have ever used?",
    suggestedAnswer: "I used a cruise ship. I went with my family. It was interesting. I liked it very much.",
    audioUrl: "/audio/part1/tr11.wav"
  },
  {
    id: "tr12",
    topic: "Means of Transport",
    question: "Can you drive a car?",
    suggestedAnswer: "Yes, I can drive. I drive almost every day. It is convenient and fast for me.",
    audioUrl: "/audio/part1/tr12.wav"
  }
];

export interface ExpansionQuestion {
  id: string;
  question: string;
  category: string;
  slowAudioUrl: string;
  normalAudioUrl: string;
  chineseMeaning?: string;
}

export interface TopicExpansion {
  mainTopic: string;
  smallTopics: string[];
  expansionQuestions: ExpansionQuestion[];
}

export const TOPIC_EXPANSION_BANK: TopicExpansion[] = [
  {
    mainTopic: "My Family",
    smallTopics: ["My daughter", "My husband", "My house", "Family activities", "My cats"],
    expansionQuestions: [
      {
        id: "family_part1_q1",
        category: "Basic Family Information",
        question: "Can you tell me about your family?",
        chineseMeaning: "你能介绍一下你的家庭吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q2",
        category: "Basic Family Information",
        question: "Who do you live with?",
        chineseMeaning: "你和谁住在一起？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q3",
        category: "Basic Family Information",
        question: "How many people are there in your family?",
        chineseMeaning: "你家里有几口人？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q4",
        category: "Basic Family Information",
        question: "Do you have any children?",
        chineseMeaning: "你有孩子吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q5",
        category: "Basic Family Information",
        question: "Can you tell me about your daughter?",
        chineseMeaning: "你能说说你的女儿吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q6",
        category: "Basic Family Information",
        question: "Can you tell me about your husband?",
        chineseMeaning: "你能说说你的丈夫吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q7",
        category: "Living Situation",
        question: "Where do you live now?",
        chineseMeaning: "你现在住在哪里？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q8",
        category: "Living Situation",
        question: "Do you live in a house or a flat?",
        chineseMeaning: "你住在房子还是公寓里？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q9",
        category: "Living Situation",
        question: "Do you like your home?",
        chineseMeaning: "你喜欢你的家吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q10",
        category: "Living Situation",
        question: "What do you like most about your home?",
        chineseMeaning: "你最喜欢你家里的什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q11",
        category: "Living Situation",
        question: "How many rooms are there in your house?",
        chineseMeaning: "你的房子有几个房间？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q12",
        category: "Duration and UK Life",
        question: "How long have you lived in the UK?",
        chineseMeaning: "你在英国住了多久了？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q13",
        category: "Duration and UK Life",
        question: "When did you come to the UK?",
        chineseMeaning: "你什么时候来到英国的？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q14",
        category: "Duration and UK Life",
        question: "How long have you lived in your current home?",
        chineseMeaning: "你在现在的家住了多久了？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q15",
        category: "Duration and UK Life",
        question: "How long has your daughter studied in the UK?",
        chineseMeaning: "你的女儿在英国学习多久了？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q16",
        category: "Daily Family Life",
        question: "What do you usually do with your family?",
        chineseMeaning: "你平时和家人一起做什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q17",
        category: "Daily Family Life",
        question: "What do you usually do at home?",
        chineseMeaning: "你平时在家做什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q18",
        category: "Daily Family Life",
        question: "Do you often have dinner with your family?",
        chineseMeaning: "你经常和家人一起吃晚饭吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q19",
        category: "Daily Family Life",
        question: "Who usually cooks in your family?",
        chineseMeaning: "你家通常谁做饭？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q20",
        category: "Daily Family Life",
        question: "What do you and your family usually do at weekends?",
        chineseMeaning: "你和家人周末通常做什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q21",
        category: "Family Activities",
        question: "What activities do you enjoy doing with your family?",
        chineseMeaning: "你喜欢和家人一起做什么活动？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q22",
        category: "Family Activities",
        question: "Where do you usually go with your family?",
        chineseMeaning: "你通常和家人去哪里？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q23",
        category: "Family Activities",
        question: "Do you like travelling with your family?",
        chineseMeaning: "你喜欢和家人一起旅行吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q24",
        category: "Family Activities",
        question: "What was the last thing you did with your family?",
        chineseMeaning: "你最近一次和家人一起做了什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q25",
        category: "Children and School",
        question: "Does your daughter go to school in the UK?",
        chineseMeaning: "你的女儿在英国上学吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q26",
        category: "Children and School",
        question: "What year is your daughter in at school?",
        chineseMeaning: "你的女儿现在几年级？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q27",
        category: "Children and School",
        question: "Is your daughter preparing for GCSEs?",
        chineseMeaning: "你的女儿在准备 GCSE 吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q28",
        category: "Children and School",
        question: "What subjects does your daughter like?",
        chineseMeaning: "你的女儿喜欢哪些科目？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q29",
        category: "Children and School",
        question: "Do you help your daughter with her homework?",
        chineseMeaning: "你会帮女儿做作业吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q30",
        category: "Children and School",
        question: "Do you feel worried about your daughter’s exams?",
        chineseMeaning: "你会担心女儿的考试吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q31",
        category: "Children and School",
        question: "What does your daughter want to do after GCSEs?",
        chineseMeaning: "你的女儿 GCSE 之后想做什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q32",
        category: "Preferences",
        question: "Do you prefer spending time at home or going out with your family?",
        chineseMeaning: "你更喜欢和家人在家待着，还是一起出去？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q33",
        category: "Preferences",
        question: "Do you prefer eating at home or eating in a restaurant with your family?",
        chineseMeaning: "你更喜欢和家人在家吃饭，还是去餐馆吃饭？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q34",
        category: "Reasons and Opinions",
        question: "Why is family important to you?",
        chineseMeaning: "为什么家庭对你很重要？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q35",
        category: "Reasons and Opinions",
        question: "Why do you enjoy spending time with your family?",
        chineseMeaning: "你为什么喜欢和家人一起度过时间？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q36",
        category: "Recent and Past Experience",
        question: "Have you done anything special with your family recently?",
        chineseMeaning: "你最近和家人做过什么特别的事情吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q37",
        category: "Recent and Past Experience",
        question: "Have you ever travelled with your family?",
        chineseMeaning: "你曾经和家人一起旅行过吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q38",
        category: "Future Plans",
        question: "What will you do with your family next weekend?",
        chineseMeaning: "下个周末你会和家人做什么？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      },
      {
        id: "family_part1_q39",
        category: "Future Plans",
        question: "Would you like to travel with your family in the future?",
        chineseMeaning: "你将来想和家人一起旅行吗？",
        slowAudioUrl: "",
        normalAudioUrl: ""
      }
    ]
  }
];

